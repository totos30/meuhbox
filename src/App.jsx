import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scene from './Scene.jsx'
import AddSound, { imageFromBuffer } from './AddSound.jsx'
import { ANIMALS, CUSTOM_COLORS, drawCustomLabel, drawLabel } from './labels.js'
import { MAX_SECONDS, decodeAudio, deformation, playCry, playFlipSigh, playSample, unlockAudio } from './audio.js'
import { deleteSound, loadSounds, saveSound } from './store.js'

const DOWN = -0.45 // seuil « tête en bas »
const UP = 0.45 // seuil « à l'endroit »
const MIN_SECONDS = 0.3

const fmt = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

function Thumb({ canvas, version }) {
  const ref = useRef()
  useEffect(() => {
    const c = ref.current
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    // recadrage sur la face avant de l'étiquette
    ctx.drawImage(canvas, 774, 40, 500, 560, 0, 0, c.width, c.height)
  }, [canvas, version])
  return <canvas ref={ref} width="100" height="112" className="thumb" aria-hidden="true" />
}

export default function App() {
  const [animalId, setAnimalId] = useState('vache')
  const [fontsReady, setFontsReady] = useState(false)
  const [sensor, setSensor] = useState('off') // off | waiting | active | denied | unavailable
  const [flipped, setFlipped] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [last, setLast] = useState(null)
  const [customs, setCustoms] = useState([])
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [saveWarning, setSaveWarning] = useState(false)

  const motion = useRef({ angleX: 0, dragAngle: 0, mode: 'drag', playingUntil: 0, lastK: 0 })
  const flip = useRef({ flipped: false, start: 0 })
  const sensorRef = useRef(sensor)
  sensorRef.current = sensor

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true))
  }, [])

  // ——— Étiquettes des sons intégrés ———
  const builtins = useMemo(
    () => ANIMALS.map((a) => ({ ...a, kind: 'builtin', canvas: drawLabel(document.createElement('canvas'), a) })),
    []
  )
  // redessin des étiquettes à texte une fois la police chargée
  const labelVersion = fontsReady ? 1 : 0
  useEffect(() => {
    if (!fontsReady) return
    builtins.forEach((b) => drawLabel(b.canvas, b))
    setCustoms((list) => {
      list.forEach((c) => drawCustomLabel(c.canvas, c))
      return [...list]
    })
  }, [fontsReady, builtins])

  // ——— Sons perso enregistrés sur l'appareil ———
  useEffect(() => {
    let alive = true
    loadSounds().then(async (records) => {
      const items = []
      for (const r of records) {
        try {
          const buffer = await decodeAudio(r.audioData)
          const image = r.imageData ? await imageFromBuffer(r.imageData, r.imageType) : null
          const item = { id: r.id, name: r.name, color: r.color, kind: 'custom', cry: 'Son perso', buffer, image }
          item.canvas = drawCustomLabel(document.createElement('canvas'), item)
          items.push(item)
        } catch (e) {
          /* fichier illisible : ignoré */
        }
      }
      if (alive && items.length) setCustoms((list) => [...items, ...list.filter((c) => !items.some((i) => i.id === c.id))])
    })
    return () => {
      alive = false
    }
  }, [])

  const sounds = useMemo(() => [...builtins, ...customs], [builtins, customs])
  const current = sounds.find((s) => s.id === animalId) || builtins[0]
  const soundRef = useRef(current)
  soundRef.current = current

  const play = (sound, k) => (sound.kind === 'custom' ? playSample(sound.buffer, k) : playCry(sound.id, k))

  const addSound = async (data) => {
    const id = `perso-${Date.now()}`
    const item = { id, name: data.name, color: data.color, kind: 'custom', cry: 'Son perso', buffer: data.buffer, image: data.image }
    item.canvas = drawCustomLabel(document.createElement('canvas'), item)
    const ok = await saveSound({
      id,
      name: data.name,
      color: data.color,
      audioData: data.audioData,
      audioType: data.audioType,
      imageData: data.imageData,
      imageType: data.imageType,
      createdAt: Date.now(),
    })
    setSaveWarning(!ok)
    setCustoms((list) => [...list, item])
    setAnimalId(id)
    setAdding(false)
  }

  const removeSound = (id) => {
    deleteSound(id)
    setCustoms((list) => list.filter((c) => c.id !== id))
    setPendingDelete(null)
    if (animalId === id) setAnimalId('vache')
  }

  // ——— Cœur du jeu : détection retourné / remis à l'endroit ———
  const evaluate = useCallback((upY) => {
    const f = flip.current
    const now = performance.now()
    if (!f.flipped && upY < DOWN) {
      f.flipped = true
      f.start = now
      setFlipped(true)
      setElapsed(0)
      playFlipSigh()
    } else if (f.flipped && upY > UP) {
      f.flipped = false
      setFlipped(false)
      const seconds = (now - f.start) / 1000
      if (seconds < MIN_SECONDS) return
      const k = Math.min(seconds / MAX_SECONDS, 1)
      const snd = soundRef.current
      const dur = snd.kind === 'custom' ? playSample(snd.buffer, k) : playCry(snd.id, k)
      motion.current.playingUntil = now + dur * 1000
      motion.current.lastK = k
      setLast({ seconds, k, ...deformation(k) })
      try { navigator.vibrate?.(Math.round(120 + 400 * k)) } catch (e) { /* non supporté */ }
    }
  }, [])

  // chronomètre pendant que la boîte est retournée
  useEffect(() => {
    if (!flipped) return
    const id = setInterval(() => setElapsed((performance.now() - flip.current.start) / 1000), 50)
    return () => clearInterval(id)
  }, [flipped])

  // ——— Gyroscope ———
  const onOrientation = useCallback(
    (e) => {
      if (e.beta == null) return
      if (sensorRef.current !== 'active') setSensor('active')
      motion.current.mode = 'sensor'
      const beta = e.beta
      // beta = 90° : téléphone debout ; −90° : tête en bas
      motion.current.angleX = ((90 - beta) * Math.PI) / 180
      evaluate(Math.sin((beta * Math.PI) / 180))
    },
    [evaluate]
  )

  const enableSensors = useCallback(async () => {
    unlockAudio()
    const DOE = window.DeviceOrientationEvent
    if (!DOE) return setSensor('unavailable')
    try {
      if (typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission()
        if (res !== 'granted') return setSensor('denied')
      }
    } catch (e) {
      return setSensor('denied')
    }
    setSensor('waiting')
    window.addEventListener('deviceorientation', onOrientation)
    setTimeout(() => {
      if (sensorRef.current === 'waiting') {
        window.removeEventListener('deviceorientation', onOrientation)
        setSensor('unavailable')
      }
    }, 1800)
  }, [onOrientation])

  useEffect(() => () => window.removeEventListener('deviceorientation', onOrientation), [onOrientation])

  const sensorOn = sensor === 'active'

  // ——— Mode glisser (ordinateur, ou capteurs indisponibles) ———
  const drag = useRef(null)
  const onPointerDown = (e) => {
    unlockAudio()
    if (sensorOn) return
    drag.current = { y: e.clientY, a: motion.current.dragAngle }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const a = drag.current.a + (e.clientY - drag.current.y) * 0.012
    motion.current.dragAngle = a
    motion.current.angleX = a
    evaluate(Math.cos(a))
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    const snapped = Math.round(motion.current.dragAngle / Math.PI) * Math.PI
    motion.current.dragAngle = snapped
    motion.current.angleX = snapped
    evaluate(Math.cos(snapped))
  }
  const toggleFlip = () => {
    unlockAudio()
    const a = motion.current.dragAngle + Math.PI
    motion.current.dragAngle = a
    motion.current.angleX = a
    evaluate(Math.cos(a))
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !sensorOn && e.target === document.body) {
        e.preventDefault()
        toggleFlip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const live = flipped ? Math.min(elapsed, MAX_SECONDS) : 0
  const liveK = live / MAX_SECONDS
  const liveDef = deformation(liveK)

  const hint = useMemo(() => {
    if (sensorOn) return flipped ? 'Garde-le tête en bas… puis remets-le à l’endroit !' : 'Retourne ton téléphone tête en bas.'
    if (sensor === 'denied') return 'Accès au gyroscope refusé. Glisse la boîte vers le bas pour la retourner.'
    if (sensor === 'unavailable') return 'Gyroscope inaccessible ici. Glisse la boîte vers le bas pour la retourner.'
    return flipped ? 'Retournée ! Glisse-la à nouveau pour la remettre debout.' : 'Glisse la boîte vers le bas pour la retourner.'
  }, [sensor, sensorOn, flipped])

  const ticks = [0, 2, 4, 6, 8, 10]

  return (
    <div className="app">
      <header className="top">
        <h1>Boîte à Meuh</h1>
        <p className="tag">Le jouet de l’alpage, dans ton téléphone.</p>
      </header>

      <section
        className={`stage${sensorOn ? ' is-sensor' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Boîte à meuh en 3D"
      >
        <Scene labelCanvas={current.canvas} labelVersion={`${labelVersion}-${customs.length}`} motion={motion} />
        <p className={`hint${flipped ? ' is-flipped' : ''}`} aria-live="polite">{hint}</p>
      </section>

      <aside className="panel">
        <div className="block how">
          <h2>Comment ça marche</h2>
          <ol>
            <li>Choisis un son, ou ajoute le tien : son image se plaque sur la boîte.</li>
            <li>Retourne ton téléphone tête en bas et garde-le ainsi.</li>
            <li>Remets-le à l’endroit : la boîte crie. Plus tu as attendu, plus le cri sort lent, grave et fort : jusqu’à la vitesse × 0,7 après {MAX_SECONDS} s.</li>
          </ol>
          {!sensorOn && (
            <button type="button" id="sensor-btn" className="btn primary" onClick={enableSensors} disabled={sensor === 'waiting'}>
              {sensor === 'waiting' ? 'Connexion au gyroscope…' : 'Activer le gyroscope'}
            </button>
          )}
          {sensorOn && <p className="ok">Gyroscope actif</p>}
        </div>

        <div className="block">
          <h2>Le son</h2>
          <div className="sounds" role="radiogroup" aria-label="Choix du son">
            {sounds.map((a) => (
              <div key={a.id} className="sound-wrap">
                <button
                  type="button"
                  id={`sound-${a.id}`}
                  role="radio"
                  aria-checked={a.id === animalId}
                  className={`sound${a.id === animalId ? ' is-on' : ''}`}
                  onClick={() => {
                    unlockAudio()
                    setAnimalId(a.id)
                    setPendingDelete(null)
                    play(a, 0)
                  }}
                >
                  <Thumb canvas={a.canvas} version={labelVersion} />
                  <span className="sound-name">{a.kind === 'custom' ? a.name : a.name}</span>
                  <span className="sound-cry">{a.cry}</span>
                </button>
                {a.kind === 'custom' && pendingDelete !== a.id && (
                  <button type="button" className="sound-del" aria-label={`Supprimer ${a.name}`} onClick={() => setPendingDelete(a.id)}>
                    ×
                  </button>
                )}
                {pendingDelete === a.id && (
                  <div className="sound-confirm">
                    <span>Supprimer ?</span>
                    <button type="button" className="btn danger small" onClick={() => removeSound(a.id)}>Oui</button>
                    <button type="button" className="btn small" onClick={() => setPendingDelete(null)}>Non</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {adding ? (
            <AddSound
              color={CUSTOM_COLORS[customs.length % CUSTOM_COLORS.length]}
              fontsReady={fontsReady}
              onAdd={addSound}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button type="button" id="add-btn" className="btn add" onClick={() => setAdding(true)}>
              + Ajouter un son
            </button>
          )}
          {saveWarning && (
            <p className="note">Ce son n’a pas pu être enregistré sur l’appareil : il disparaîtra au rechargement de la page.</p>
          )}
        </div>

        <div className="block">
          <div className="gauge-head">
            <h2>Temps retourné</h2>
            <span className="readout">{fmt(live)} s</span>
          </div>
          <div className={`gauge${flipped ? ' is-live' : ''}`} role="meter" aria-valuemin="0" aria-valuemax={MAX_SECONDS} aria-valuenow={live.toFixed(1)} aria-label="Temps retourné">
            <div className="gauge-fill" style={{ width: `${liveK * 100}%` }} />
            {last && !flipped && <div className="gauge-last" style={{ left: `${last.k * 100}%` }} />}
          </div>
          <div className="ticks" aria-hidden="true">
            {ticks.map((t) => <span key={t}>{t}</span>)}
          </div>
          <dl className="stats">
            <div>
              <dt>Vitesse</dt>
              <dd>× {fmt(flipped ? liveDef.rate : last ? last.rate : 1, 2)}</dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd>× {flipped ? fmt(liveDef.gain) : last ? fmt(last.gain) : '1,0'}</dd>
            </div>
            <div>
              <dt>Durée du cri</dt>
              <dd>× {flipped ? fmt(liveDef.stretch) : last ? fmt(last.stretch) : '1,0'}</dd>
            </div>
          </dl>
          {!sensorOn && (
            <button type="button" id="flip-btn" className="btn" onClick={toggleFlip}>
              {flipped ? 'Remettre à l’endroit' : 'Retourner la boîte'}
            </button>
          )}
          <p className="note">Son actuel : {current.name}</p>
        </div>
      </aside>
    </div>
  )
}
