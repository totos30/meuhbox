import { useEffect, useRef, useState } from 'react'
import { drawCustomLabel } from './labels.js'
import { decodeAudio, playSample, unlockAudio } from './audio.js'

const MAX_AUDIO_MB = 15
const MAX_IMAGE_MB = 10

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

export default function AddSound({ color, fontsReady, onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [audio, setAudio] = useState(null) // { file, buffer, data }
  const [image, setImage] = useState(null) // { file, bitmap, data }
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

  const pickAudio = async (e) => {
    const file = e.target.files?.[0]
    setError('')
    setAudio(null)
    if (!file) return
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) return setError(`Le fichier audio dépasse ${MAX_AUDIO_MB} Mo.`)
    try {
      const data = await file.arrayBuffer()
      const buffer = await decodeAudio(data)
      setAudio({ file, buffer, data })
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, '').slice(0, 24))
    } catch (err) {
      setError('Ce fichier audio n’a pas pu être lu. Essaie un autre MP3.')
    }
  }

  const pickImage = async (e) => {
    const file = e.target.files?.[0]
    setError('')
    if (!file) return setImage(null)
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setError(`L’image dépasse ${MAX_IMAGE_MB} Mo.`)
    try {
      const data = await file.arrayBuffer()
      const bitmap = await imageFromBuffer(data, file.type)
      setImage({ file, bitmap, data })
    } catch (err) {
      setError('Cette image n’a pas pu être lue. Essaie un JPG ou un PNG.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Donne un nom à ton son.')
    if (!audio) return setError('Ajoute un fichier MP3.')
    setBusy(true)
    await onAdd({
      name: clean,
      color,
      buffer: audio.buffer,
      audioData: audio.data,
      audioType: audio.file.type,
      image: image?.bitmap || null,
      imageData: image?.data || null,
      imageType: image?.file.type || null,
    })
    setBusy(false)
  }

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
        <label htmlFor="add-audio">Fichier MP3</label>
        <input id="add-audio" type="file" accept=".mp3,audio/mpeg,audio/*" onChange={pickAudio} />
        {audio && (
          <div className="file-ok">
            <span>
              {audio.file.name} · {fmt(audio.buffer.duration)} s
              {audio.buffer.duration > 10 && ' (seules les 10 premières secondes seront jouées)'}
            </span>
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
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="add-image">Image <span className="opt">facultative</span></label>
        <input id="add-image" type="file" accept="image/*" onChange={pickImage} />
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
