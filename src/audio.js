// Lecture des cris (MP3 via Web Audio) + déformation selon la durée de retournement.
// k ∈ [0,1] : 0 = son normal, 1 = déformation maximale (environ 9 demi-tons plus grave, plus fort, plus long).

import cat from './sons/cat.mp3'
import cow from './sons/cow.mp3'
import goat from './sons/goat.mp3'
import sheep from './sons/sheep.mp3'

let ctx = null

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Fichiers des cris intégrés, par id d'animal (voir labels.js).
const CRY_FILES = { vache: cow, mouton: sheep, chevre: goat, chat: cat }

export const MAX_SECONDS = 5

// Règle : la vitesse baisse proportionnellement au temps retourné.
// 0 s → vitesse 1 ; 5 s (plafond) → vitesse 0,6.
export const MIN_RATE = 0.6

// Paramètres dérivés de k (= temps retourné / 5 s) — exposés pour l'affichage.
// Ralentir un son baisse sa hauteur et l'allonge, comme une bande ralentie.
export function deformation(k) {
  const rate = 1 - (1 - MIN_RATE) * k
  return {
    rate,
    semitones: 12 * Math.log2(rate),
    gain: 1 + 2 * k,
    stretch: 1 / rate,
  }
}

// Chaîne de sortie commune, sans distorsion : volume → limiteur (évite l'écrêtage).
function outputChain(c, k, gain) {
  const master = c.createGain()
  master.gain.value = 0.55 * gain
  const limiter = c.createDynamicsCompressor()
  limiter.threshold.value = -2
  limiter.ratio.value = 20
  limiter.knee.value = 0
  limiter.attack.value = 0.001
  limiter.release.value = 0.1
  master.connect(limiter).connect(c.destination)
  return { input: master, output: limiter }
}

/** Décode un fichier audio (MP3…) en AudioBuffer. */
export async function decodeAudio(arrayBuffer) {
  const c = ctx || new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100, 44100)
  return await c.decodeAudioData(arrayBuffer.slice(0))
}

// On ne joue que les 10 premières secondes du fichier, quelle que soit sa durée.
const SAMPLE_MAX_SECONDS = 10

/** Joue un son perso, déformé façon « bande ralentie ». Renvoie la durée réelle. */
export function playSample(buffer, k = 0) {
  const c = unlockAudio()
  if (!c || !buffer) return 0
  const { rate, gain } = deformation(k)
  const src = c.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  const len = Math.min(buffer.duration, SAMPLE_MAX_SECONDS)
  const env = c.createGain()
  const t0 = c.currentTime + 0.02
  const real = len / rate
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(1, t0 + 0.02)
  env.gain.setValueAtTime(1, t0 + Math.max(real - 0.12, 0.03))
  env.gain.linearRampToValueAtTime(0, t0 + real)
  const out = outputChain(c, k, gain)
  src.connect(env).connect(out.input)
  src.start(t0, 0, len)
  src.onended = () => {
    try { out.output.disconnect() } catch (e) { /* déjà déconnecté */ }
  }
  return real
}

let noiseBuffer = null
function getNoise(c) {
  if (noiseBuffer) return noiseBuffer
  noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const d = noiseBuffer.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuffer
}

const cries = {}

/** Décode à l'avance les cris intégrés, pour les jouer sans attente au retournement. */
export async function loadCries() {
  await Promise.all(
    Object.entries(CRY_FILES).map(async ([id, url]) => {
      try {
        const res = await fetch(url)
        cries[id] = await decodeAudio(await res.arrayBuffer())
      } catch (e) {
        /* fichier illisible : ignoré */
      }
    })
  )
}

/** Joue le cri et renvoie sa durée réelle en secondes. */
export function playCry(name, k = 0) {
  return playSample(cries[name], k)
}

/** Petit soupir du soufflet quand on retourne la boîte. */
export function playFlipSigh() {
  const c = ctx
  if (!c || c.state !== 'running') return
  const t0 = c.currentTime + 0.01
  const n = c.createBufferSource()
  n.buffer = getNoise(c)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(500, t0)
  f.frequency.linearRampToValueAtTime(1100, t0 + 0.35)
  f.Q.value = 1.2
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.12, t0 + 0.08)
  g.gain.linearRampToValueAtTime(0, t0 + 0.45)
  n.connect(f).connect(g).connect(c.destination)
  n.start(t0)
  n.stop(t0 + 0.5)
}
