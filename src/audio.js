// Synthèse des cris (Web Audio) + déformation selon la durée de retournement.
// k ∈ [0,1] : 0 = son normal, 1 = déformation maximale (une octave plus grave, plus fort, plus long).

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

// Préréglages : temps normalisés (0 → 1) sur la durée du cri.
export const PRESETS = {
  vache: {
    dur: 1.7,
    f0: [[0, 230], [0.15, 285], [0.6, 300], [0.88, 250], [1, 205]],
    formants: [
      { f: [[0, 260], [0.22, 560], [0.7, 520], [1, 380]], q: 5, g: 1 },
      { f: [[0, 800], [0.22, 1100], [0.7, 1000], [1, 780]], q: 6, g: 0.55 },
      { f: 2600, q: 8, g: 0.12 },
    ],
    vib: { rate: 5, depth: 4 },
    trem: null,
    noise: 0.04,
    attack: 0.14,
    release: 0.3,
  },
  mouton: {
    dur: 1.15,
    f0: [[0, 410], [0.1, 470], [0.8, 450], [1, 380]],
    formants: [
      { f: 760, q: 5, g: 1 },
      { f: 1800, q: 7, g: 0.6 },
      { f: 2800, q: 9, g: 0.25 },
    ],
    vib: { rate: 7.5, depth: 28 },
    trem: { rate: 13, depth: 0.35 },
    noise: 0.05,
    attack: 0.05,
    release: 0.22,
  },
  chevre: {
    dur: 1.25,
    f0: [[0, 350], [0.2, 385], [0.8, 340], [1, 300]],
    formants: [
      { f: 620, q: 6, g: 1 },
      { f: 2100, q: 8, g: 0.55 },
      { f: 3000, q: 9, g: 0.25 },
    ],
    vib: { rate: 6, depth: 12 },
    trem: { rate: 9.5, depth: 0.75 },
    noise: 0.08,
    attack: 0.04,
    release: 0.25,
  },
  chat: {
    dur: 1.0,
    f0: [[0, 470], [0.35, 720], [0.7, 640], [1, 420]],
    formants: [
      { f: [[0, 320], [0.4, 850], [1, 420]], q: 5, g: 1 },
      { f: [[0, 2200], [0.4, 1400], [1, 850]], q: 7, g: 0.5 },
      { f: 3000, q: 9, g: 0.18 },
    ],
    vib: { rate: 5, depth: 8 },
    trem: null,
    noise: 0.03,
    attack: 0.05,
    release: 0.28,
  },
}

export const MAX_SECONDS = 10

// Règle : la vitesse baisse proportionnellement au temps retourné.
// 0 s → vitesse 1 ; 10 s (plafond) → vitesse 0,7.
export const MIN_RATE = 0.7

// Paramètres dérivés de k (= temps retourné / 10 s) — exposés pour l'affichage.
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

function ramp(param, value, t0, dur, scale = 1) {
  if (typeof value === 'number') {
    param.setValueAtTime(value * scale, t0)
    return
  }
  param.setValueAtTime(value[0][1] * scale, t0)
  for (let i = 1; i < value.length; i++) {
    param.linearRampToValueAtTime(value[i][1] * scale, t0 + value[i][0] * dur)
  }
}

let noiseBuffer = null
function getNoise(c) {
  if (noiseBuffer) return noiseBuffer
  noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const d = noiseBuffer.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuffer
}

/** Joue le cri et renvoie sa durée réelle en secondes. */
export function playCry(name, k = 0) {
  const c = unlockAudio()
  if (!c) return 0
  const p = PRESETS[name]
  const { rate, gain, stretch } = deformation(k)
  // ralenti « bande » : hauteur, timbre et rythme ralentissent ensemble
  const pitch = rate
  const formantScale = rate
  const dur = p.dur * stretch
  const release = p.release * stretch
  const t0 = c.currentTime + 0.03
  const tEnd = t0 + dur + release + 0.1

  // Chaîne : mix → trémolo → enveloppe → sortie (saturation, compresseur, volume, limiteur)
  const mix = c.createGain()
  const am = c.createGain()
  const env = c.createGain()
  const out = outputChain(c, k, gain)
  mix.connect(am).connect(env).connect(out.input)

  // Enveloppe d'amplitude
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(1, t0 + p.attack * stretch)
  env.gain.setValueAtTime(1, t0 + dur - 0.05)
  env.gain.linearRampToValueAtTime(0, t0 + dur + release)

  // Trémolo (bêlement)
  am.gain.value = 1
  const lfos = []
  if (p.trem) {
    am.gain.value = 1 - p.trem.depth / 2
    const lfo = c.createOscillator()
    lfo.frequency.value = p.trem.rate * rate
    const lg = c.createGain()
    lg.gain.value = p.trem.depth / 2
    lfo.connect(lg).connect(am.gain)
    lfos.push(lfo)
  }

  // Sources : deux dents de scie désaccordées (l'anche de la boîte)
  const oscs = [-7, 7].map((detune) => {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.detune.value = detune
    ramp(o.frequency, p.f0, t0, dur, pitch)
    if (p.vib) {
      const lfo = c.createOscillator()
      lfo.frequency.value = p.vib.rate * rate
      const lg = c.createGain()
      lg.gain.value = p.vib.depth * pitch
      lfo.connect(lg).connect(o.frequency)
      lfos.push(lfo)
    }
    return o
  })
  const srcSum = c.createGain()
  srcSum.gain.value = 0.5
  oscs.forEach((o) => o.connect(srcSum))

  // Souffle du soufflet
  const noise = c.createBufferSource()
  noise.buffer = getNoise(c)
  noise.loop = true
  const nf = c.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.value = 1400 * formantScale
  nf.Q.value = 0.8
  const ng = c.createGain()
  ng.gain.value = p.noise * 3
  noise.connect(nf).connect(ng).connect(srcSum)

  // Banc de formants (la « voix » de l'animal)
  p.formants.forEach((fm) => {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = fm.q
    ramp(bp.frequency, fm.f, t0, dur, formantScale)
    const g = c.createGain()
    g.gain.value = fm.g * 2.2
    srcSum.connect(bp).connect(g).connect(mix)
  })
  const direct = c.createBiquadFilter()
  direct.type = 'lowpass'
  direct.frequency.value = 900 * formantScale
  const dg = c.createGain()
  dg.gain.value = 0.25
  srcSum.connect(direct).connect(dg).connect(mix)

  ;[...oscs, ...lfos, noise].forEach((s) => {
    s.start(t0)
    s.stop(tEnd)
  })
  oscs[0].onended = () => {
    try { out.output.disconnect() } catch (e) { /* déjà déconnecté */ }
  }
  return dur + release
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
