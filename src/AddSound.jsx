import { useEffect, useRef, useState } from 'react'
import { drawCustomLabel } from './labels.js'
import { decodeAudio, playSample, unlockAudio } from './audio.js'
import { canRecord, useHoldRecorder } from './recorder.js'

const MAX_AUDIO_MB = 15
const MAX_IMAGE_MB = 10

// Appareil photo natif : seulement sur téléphone / tablette (sur ordinateur, ce serait un 2e sélecteur de fichiers).
const hasCamera = !!window.matchMedia?.('(pointer: coarse)').matches

export async function imageFromBuffer(buffer, type) {
  const blob = new Blob([buffer], { type: type || 'image/*' })
  if (window.createImageBitmap) return await createImageBitmap(blob)
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

const fmt = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
)

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

export default function AddSound({ color, fontsReady, onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [audio, setAudio] = useState(null) // { label, buffer, data, type }
  const [image, setImage] = useState(null) // { label, bitmap, data, type }
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const preview = useRef()
  const nameRef = useRef()

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // aperçu de l'étiquette déroulée (tout le tour de la boîte)
  useEffect(() => {
    drawCustomLabel(preview.current, { name: name.trim() || 'Mon son', image: image?.bitmap, color })
  }, [name, image, color, fontsReady])

  const loadAudio = async (data, type, label) => {
    const buffer = await decodeAudio(data)
    setAudio({ label, buffer, data, type })
  }

  const recorder = useHoldRecorder({
    onDone: async (blob) => {
      try {
        await loadAudio(await blob.arrayBuffer(), blob.type, 'Enregistrement')
      } catch (err) {
        setError('L’enregistrement n’a pas pu être lu. Réessaie.')
      }
    },
    onMessage: (text, isError) => {
      setError(isError ? text : '')
      setNote(isError ? '' : text)
    },
  })

  const pickAudio = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setNote('')
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) return setError(`Le fichier audio dépasse ${MAX_AUDIO_MB} Mo.`)
    try {
      await loadAudio(await file.arrayBuffer(), file.type, file.name)
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, '').slice(0, 24))
    } catch (err) {
      setError('Ce fichier audio n’a pas pu être lu. Essaie un autre fichier.')
    }
  }

  const pickImage = (fromCamera) => async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setError(`L’image dépasse ${MAX_IMAGE_MB} Mo.`)
    try {
      const data = await file.arrayBuffer()
      const bitmap = await imageFromBuffer(data, file.type)
      setImage({ label: fromCamera ? 'Photo prise' : file.name, bitmap, data, type: file.type })
    } catch (err) {
      setError('Cette image n’a pas pu être lue. Essaie un JPG ou un PNG.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Donne un nom à ton son.')
    if (!audio) return setError('Ajoute un son : un fichier ou un enregistrement.')
    setBusy(true)
    await onAdd({
      name: clean,
      color,
      buffer: audio.buffer,
      audioData: audio.data,
      audioType: audio.type,
      image: image?.bitmap || null,
      imageData: image?.data || null,
      imageType: image?.type || null,
    })
    setBusy(false)
  }

  const { recording, elapsed } = recorder
  const audioStatus = recording
    ? `Enregistre… ${fmt(elapsed)} s`
    : audio
      ? `${audio.label} · ${fmt(audio.buffer.duration)} s`
      : 'Aucun fichier choisi'

  return (
    <form className="add-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="add-name">Nom du son</label>
        <input
          ref={nameRef}
          id="add-name"
          type="text"
          maxLength={24}
          placeholder="ex. Le coq de mamie"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="add-audio">Son</label>
        <div className="picker">
          <input id="add-audio" className="file-input" type="file" accept=".mp3,audio/mpeg,audio/*" onChange={pickAudio} />
          <label htmlFor="add-audio" className="pick-btn">Choisir un fichier</label>
          {canRecord() && (
            <button
              type="button"
              className={`icon-btn rec${recording ? ' is-on' : ''}`}
              aria-label="Maintenir pour enregistrer"
              title="Maintenir pour enregistrer"
              {...recorder.bind}
            >
              <MicIcon />
            </button>
          )}
          <span className={`pick-status${recording ? ' is-rec' : ''}`} aria-live="polite">{audioStatus}</span>
          {audio && !recording && (
            <button
              type="button"
              className="link"
              onClick={() => {
                unlockAudio()
                playSample(audio.buffer, 0)
              }}
            >
              Écouter
            </button>
          )}
        </div>
        {note && <p className="help" role="status">{note}</p>}
        {audio?.buffer.duration > 10 && <p className="help">Seules les 10 premières secondes seront jouées.</p>}
      </div>

      <div className="field">
        <label htmlFor="add-image">Image <span className="opt">facultative</span></label>
        <div className="picker">
          <input id="add-image" className="file-input" type="file" accept="image/*" onChange={pickImage(false)} />
          <label htmlFor="add-image" className="pick-btn">Choisir un fichier</label>
          {hasCamera && (
            <>
              <input id="add-photo" className="file-input" type="file" accept="image/*" capture="environment" aria-label="Prendre une photo" onChange={pickImage(true)} />
              <label htmlFor="add-photo" className="icon-btn" title="Prendre une photo">
                <CameraIcon />
              </label>
            </>
          )}
          <span className="pick-status">{image ? image.label : 'Aucun fichier choisi'}</span>
          {image && (
            <button type="button" className="link" onClick={() => setImage(null)}>
              Retirer
            </button>
          )}
        </div>
        <p className="help">Elle couvre tout le tour de la boîte. Sans image, c’est le nom du son qui s’affiche.</p>
      </div>

      <div className="field">
        <span className="label">Aperçu de l’étiquette déroulée</span>
        <canvas ref={preview} className="strip" aria-label="Aperçu de l’étiquette" />
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="row">
        <button type="button" className="btn" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Ajout…' : 'Ajouter le son'}
        </button>
      </div>
    </form>
  )
}
