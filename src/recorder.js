// Enregistrement au micro « appuyer-maintenir » : on enregistre tant que le bouton est tenu.
import { useEffect, useRef, useState } from 'react'

const MIN_SECONDS = 0.3
const MAX_SECONDS = 10 // seules les 10 premières secondes d'un son sont jouées

// Le micro n'est accessible qu'en HTTPS (ou sur localhost).
export const canRecord = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder)

/**
 * onDone(blob) : enregistrement terminé.
 * onMessage(texte, estErreur) : consigne ou erreur à afficher ('' pour effacer).
 */
export function useHoldRecorder({ onDone, onMessage }) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const s = useRef({ held: false, stream: null, rec: null, start: 0, timer: 0, limit: 0 })
  const cb = useRef()
  cb.current = { onDone, onMessage }

  const clearTimers = () => {
    clearInterval(s.current.timer)
    clearTimeout(s.current.limit)
  }

  const stop = () => {
    const rec = s.current.rec
    if (rec && rec.state !== 'inactive') rec.stop()
  }

  const begin = (stream) => {
    const r = s.current
    const chunks = []
    const rec = new MediaRecorder(stream)
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const seconds = (performance.now() - r.start) / 1000
      clearTimers()
      r.rec = null
      setRecording(false)
      if (seconds < MIN_SECONDS) return cb.current.onMessage('Maintiens le bouton appuyé pendant que tu enregistres.')
      cb.current.onDone(new Blob(chunks, { type: rec.mimeType }))
    }
    r.rec = rec
    r.start = performance.now()
    rec.start()
    setElapsed(0)
    setRecording(true)
    r.timer = setInterval(() => setElapsed((performance.now() - r.start) / 1000), 100)
    r.limit = setTimeout(stop, MAX_SECONDS * 1000)
  }

  const press = async () => {
    const r = s.current
    if (r.held || r.rec) return
    r.held = true
    cb.current.onMessage('')
    // Le micro reste ouvert tant que le formulaire est affiché : l'ouvrir à chaque appui
    // prend parfois une seconde, et le début de l'enregistrement serait perdu.
    if (!r.stream?.active) {
      try {
        r.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (e) {
        r.held = false
        return cb.current.onMessage(
          e.name === 'NotAllowedError' ? 'Accès au micro refusé. Autorise-le dans les réglages du navigateur.' : 'Micro indisponible sur cet appareil.',
          true
        )
      }
    }
    // Bouton déjà relâché (le temps d'autoriser le micro, ou simple tape) : on n'enregistre pas.
    if (!r.held) return cb.current.onMessage('Micro prêt : maintiens le bouton appuyé pour enregistrer.')
    begin(r.stream)
  }

  const unpress = () => {
    s.current.held = false
    stop()
  }

  useEffect(
    () => () => {
      const r = s.current
      r.held = false
      if (r.rec) {
        r.rec.onstop = null
        if (r.rec.state !== 'inactive') r.rec.stop()
      }
      clearTimers()
      r.stream?.getTracks().forEach((t) => t.stop())
      r.stream = null
    },
    []
  )

  const isKey = (e) => e.key === ' ' || e.key === 'Enter'
  const bind = {
    onPointerDown: (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      press()
    },
    onPointerUp: unpress,
    onPointerCancel: unpress,
    onKeyDown: (e) => {
      if (!isKey(e)) return
      e.preventDefault()
      if (!e.repeat) press()
    },
    onKeyUp: (e) => {
      if (!isKey(e)) return
      e.preventDefault()
      unpress()
    },
    onBlur: unpress,
    onContextMenu: (e) => e.preventDefault(),
  }

  return { recording, elapsed, bind }
}
