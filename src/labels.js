// Étiquettes illustrées (dessins originaux) générées sur canvas,
// plaquées ensuite comme texture autour du cylindre.
// Format 2048 × 652 ≈ circonférence/hauteur du cylindre → pas de déformation.

export const LABEL_W = 2048
export const LABEL_H = 652

export const ANIMALS = [
  { id: 'vache', name: 'La vache', cry: 'Meuh !', bg: '#C8242C', band: '#8F141B' },
  { id: 'mouton', name: 'Le mouton', cry: 'Bêêê !', bg: '#2F7FC4', band: '#1B5486' },
  { id: 'chevre', name: 'La chèvre', cry: 'Mêêê !', bg: '#E2802A', band: '#A85614' },
  { id: 'chat', name: 'Le chat', cry: 'Miaou !', bg: '#6E46AE', band: '#462B75' },
]

const DISPLAY = "'Bagel Fat One', 'Arial Black', system-ui, sans-serif"

function ellipse(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

function eye(ctx, x, y, r = 22) {
  ellipse(ctx, x, y, r, r * 1.15, '#15171A')
  ellipse(ctx, x + r * 0.35, y - r * 0.4, r * 0.32, r * 0.32, '#FFFFFF')
}

function outline(ctx, w = 8) {
  ctx.lineWidth = w
  ctx.strokeStyle = '#15171A'
  ctx.stroke()
}

function background(ctx, a) {
  ctx.fillStyle = a.bg
  ctx.fillRect(0, 0, LABEL_W, LABEL_H)
  // trame de points imprimée sur tôle
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  for (let y = 18; y < LABEL_H; y += 36) {
    for (let x = (y / 36) % 2 ? 18 : 36; x < LABEL_W; x += 36) {
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // filets blancs haut et bas (bord de tôle)
  ctx.fillStyle = a.band
  ctx.fillRect(0, 0, LABEL_W, 26)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 26, LABEL_W, 6)
}

function meadow(ctx) {
  const top = 560
  ctx.fillStyle = '#3E9B3A'
  ctx.fillRect(0, top, LABEL_W, LABEL_H - top)
  ctx.fillStyle = '#56B84D'
  for (let x = 0; x < LABEL_W; x += 22) {
    const h = 26 + ((x * 37) % 23)
    ctx.beginPath()
    ctx.moveTo(x, top + 4)
    ctx.lineTo(x + 11, top - h)
    ctx.lineTo(x + 22, top + 4)
    ctx.fill()
  }
  // fleurs
  for (let x = 60; x < LABEL_W; x += 173) {
    const y = top + 30 + ((x * 13) % 40)
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2
      ellipse(ctx, x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, 7, 7, '#FFFFFF')
    }
    ellipse(ctx, x, y, 6, 6, '#F6C531')
  }
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, LABEL_H - 30, LABEL_W, 6)
}

function texts(ctx, a) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // onomatopée, à droite de l'animal
  ctx.save()
  ctx.translate(1530, 250)
  ctx.rotate(-0.09)
  ctx.font = `140px ${DISPLAY}`
  ctx.lineJoin = 'round'
  ctx.lineWidth = 22
  ctx.strokeStyle = '#15171A'
  ctx.strokeText(a.cry, 0, 0)
  ctx.fillStyle = '#FFE14A'
  ctx.fillText(a.cry, 0, 0)
  ctx.restore()
  // nom de l'animal, à gauche
  ctx.font = `76px ${DISPLAY}`
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(a.name.toUpperCase(), 520, 300)
  // au dos (chevauche la jointure x = 0 / x = 2048)
  ctx.font = `54px ${DISPLAY}`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ;[0, LABEL_W].forEach((x) => {
    ctx.fillText('RETOURNE-MOI', x, 210)
    ctx.fillText('↻', x, 300)
  })
}

// ——— Animaux (vue de face, centrés en x = 1024) ———

function drawCow(ctx) {
  const cx = 1024
  // cornes
  ctx.fillStyle = '#F4E7C8'
  ;[-1, 1].forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(cx + s * 70, 150)
    ctx.quadraticCurveTo(cx + s * 120, 60, cx + s * 95, 40)
    ctx.quadraticCurveTo(cx + s * 150, 80, cx + s * 120, 170)
    ctx.closePath()
    ctx.fill()
    outline(ctx, 7)
  })
  // oreilles
  ;[-1, 1].forEach((s) => {
    ellipse(ctx, cx + s * 185, 215, 70, 34, '#FFFFFF', s * 0.35)
    outline(ctx, 7)
    ellipse(ctx, cx + s * 190, 215, 44, 18, '#F3A3B4', s * 0.35)
  })
  // cloche
  ctx.fillStyle = '#2C5DA8'
  ctx.fillRect(cx - 120, 470, 240, 26)
  ctx.beginPath()
  ctx.moveTo(cx - 38, 490)
  ctx.lineTo(cx + 38, 490)
  ctx.lineTo(cx + 56, 556)
  ctx.lineTo(cx - 56, 556)
  ctx.closePath()
  ctx.fillStyle = '#F2C230'
  ctx.fill()
  outline(ctx, 7)
  // tête
  ellipse(ctx, cx, 290, 150, 180, '#FFFFFF')
  outline(ctx)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, 290, 146, 176, 0, 0, Math.PI * 2)
  ctx.clip()
  ellipse(ctx, cx - 110, 170, 90, 70, '#15171A', 0.4)
  ellipse(ctx, cx + 90, 260, 55, 75, '#15171A', -0.3)
  ctx.restore()
  // museau
  ellipse(ctx, cx, 395, 125, 78, '#F4A6B6')
  outline(ctx, 7)
  ellipse(ctx, cx - 45, 395, 18, 26, '#9C4458')
  ellipse(ctx, cx + 45, 395, 18, 26, '#9C4458')
  // yeux
  eye(ctx, cx - 62, 262, 24)
  ellipse(ctx, cx + 62, 262, 30, 34, '#FFFFFF')
  eye(ctx, cx + 62, 262, 24)
}

function drawSheep(ctx) {
  const cx = 1024
  // laine
  const puffs = [
    [-150, 200], [-90, 140], [0, 115], [90, 140], [150, 200], [175, 290],
    [150, 380], [90, 440], [0, 460], [-90, 440], [-150, 380], [-175, 290],
  ]
  puffs.forEach(([x, y]) => {
    ellipse(ctx, cx + x, y, 72, 72, '#FFFFFF')
    outline(ctx, 7)
  })
  ellipse(ctx, cx, 290, 175, 175, '#FFFFFF')
  // oreilles
  ;[-1, 1].forEach((s) => {
    ellipse(ctx, cx + s * 150, 270, 78, 30, '#3A3D44', s * -0.25)
    outline(ctx, 7)
  })
  // tête
  ellipse(ctx, cx, 315, 100, 135, '#3A3D44')
  outline(ctx)
  // toupet
  ;[-50, 0, 50].forEach((x) => {
    ellipse(ctx, cx + x, 185, 48, 42, '#FFFFFF')
    outline(ctx, 6)
  })
  ellipse(ctx, cx, 200, 80, 30, '#FFFFFF')
  eye(ctx, cx - 45, 290, 20)
  eye(ctx, cx + 45, 290, 20)
  ellipse(ctx, cx, 400, 34, 20, '#E89AAA')
  ctx.beginPath()
  ctx.moveTo(cx - 28, 430)
  ctx.quadraticCurveTo(cx, 450, cx + 28, 430)
  ctx.lineWidth = 6
  ctx.strokeStyle = '#E89AAA'
  ctx.stroke()
}

function drawGoat(ctx) {
  const cx = 1024
  // cornes recourbées
  ;[-1, 1].forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(cx + s * 50, 150)
    ctx.bezierCurveTo(cx + s * 70, 30, cx + s * 200, 20, cx + s * 230, 110)
    ctx.lineWidth = 34
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#15171A'
    ctx.stroke()
    ctx.lineWidth = 22
    ctx.strokeStyle = '#B9A88A'
    ctx.stroke()
  })
  // oreilles horizontales
  ;[-1, 1].forEach((s) => {
    ellipse(ctx, cx + s * 175, 230, 85, 30, '#EADFCB', s * 0.15)
    outline(ctx, 7)
  })
  // barbiche
  ctx.beginPath()
  ctx.moveTo(cx - 40, 430)
  ctx.lineTo(cx + 40, 430)
  ctx.lineTo(cx + 6, 560)
  ctx.lineTo(cx - 6, 560)
  ctx.closePath()
  ctx.fillStyle = '#EADFCB'
  ctx.fill()
  outline(ctx, 7)
  // tête allongée
  ctx.beginPath()
  ctx.moveTo(cx - 120, 200)
  ctx.quadraticCurveTo(cx - 130, 120, cx, 120)
  ctx.quadraticCurveTo(cx + 130, 120, cx + 120, 200)
  ctx.quadraticCurveTo(cx + 95, 450, cx, 460)
  ctx.quadraticCurveTo(cx - 95, 450, cx - 120, 200)
  ctx.closePath()
  ctx.fillStyle = '#F6EFE2'
  ctx.fill()
  outline(ctx)
  // liste brune
  ctx.beginPath()
  ctx.moveTo(cx - 25, 130)
  ctx.lineTo(cx + 25, 130)
  ctx.lineTo(cx + 18, 330)
  ctx.lineTo(cx - 18, 330)
  ctx.fillStyle = '#9B7650'
  ctx.fill()
  // yeux à pupille horizontale
  ;[-1, 1].forEach((s) => {
    ellipse(ctx, cx + s * 62, 255, 30, 26, '#F2C230')
    outline(ctx, 6)
    ellipse(ctx, cx + s * 62, 255, 22, 8, '#15171A')
  })
  ellipse(ctx, cx, 410, 60, 36, '#E8BFA6')
  ellipse(ctx, cx - 22, 405, 9, 13, '#6E4A3A')
  ellipse(ctx, cx + 22, 405, 9, 13, '#6E4A3A')
}

function drawCat(ctx) {
  const cx = 1024
  // oreilles
  ;[-1, 1].forEach((s) => {
    ctx.beginPath()
    ctx.moveTo(cx + s * 50, 150)
    ctx.lineTo(cx + s * 170, 50)
    ctx.lineTo(cx + s * 175, 210)
    ctx.closePath()
    ctx.fillStyle = '#F29A3A'
    ctx.fill()
    outline(ctx)
    ctx.beginPath()
    ctx.moveTo(cx + s * 90, 155)
    ctx.lineTo(cx + s * 160, 95)
    ctx.lineTo(cx + s * 160, 185)
    ctx.closePath()
    ctx.fillStyle = '#F7C1C9'
    ctx.fill()
  })
  // tête
  ellipse(ctx, cx, 310, 195, 165, '#F29A3A')
  outline(ctx)
  // rayures
  ctx.fillStyle = '#C66A1E'
  ;[-40, 0, 40].forEach((x) => {
    ctx.beginPath()
    ctx.moveTo(cx + x - 14, 150)
    ctx.lineTo(cx + x + 14, 150)
    ctx.lineTo(cx + x, 215)
    ctx.closePath()
    ctx.fill()
  })
  // joues claires
  ellipse(ctx, cx - 60, 395, 80, 58, '#FCE4C4')
  ellipse(ctx, cx + 60, 395, 80, 58, '#FCE4C4')
  // yeux en amande
  ;[-1, 1].forEach((s) => {
    ellipse(ctx, cx + s * 78, 295, 42, 32, '#7CC85A')
    outline(ctx, 6)
    ellipse(ctx, cx + s * 78, 295, 9, 28, '#15171A')
  })
  // nez + bouche
  ctx.beginPath()
  ctx.moveTo(cx - 20, 360)
  ctx.lineTo(cx + 20, 360)
  ctx.lineTo(cx, 382)
  ctx.closePath()
  ctx.fillStyle = '#E86A86'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx, 382)
  ctx.quadraticCurveTo(cx - 10, 415, cx - 38, 405)
  ctx.moveTo(cx, 382)
  ctx.quadraticCurveTo(cx + 10, 415, cx + 38, 405)
  outline(ctx, 6)
  // moustaches
  ctx.beginPath()
  ;[-1, 1].forEach((s) => {
    ;[-18, 4, 26].forEach((dy) => {
      ctx.moveTo(cx + s * 120, 385 + dy)
      ctx.lineTo(cx + s * 250, 370 + dy * 1.8)
    })
  })
  outline(ctx, 5)
}

const DRAWERS = { vache: drawCow, mouton: drawSheep, chevre: drawGoat, chat: drawCat }

export function drawLabel(canvas, animal) {
  canvas.width = LABEL_W
  canvas.height = LABEL_H
  const ctx = canvas.getContext('2d')
  background(ctx, animal)
  meadow(ctx)
  DRAWERS[animal.id](ctx)
  texts(ctx, animal)
  return canvas
}

/** Couvercle vert perforé, vu de dessus. */
export function drawLid(canvas) {
  const s = 512
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(s * 0.42, s * 0.4, 20, s / 2, s / 2, s / 2)
  g.addColorStop(0, '#5BCB4E')
  g.addColorStop(1, '#2E8F2A')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const rings = [[0, 1], [60, 6], [118, 12], [176, 18]]
  rings.forEach(([r, n]) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r * 0.01
      const x = s / 2 + Math.cos(a) * r
      const y = s / 2 + Math.sin(a) * r
      ellipse(ctx, x + 1.5, y + 2, 13, 13, 'rgba(255,255,255,0.35)')
      ellipse(ctx, x, y, 12, 12, '#0E2A10')
    }
  })
  // rebord
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - 14, 0, Math.PI * 2)
  ctx.lineWidth = 18
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.stroke()
  return canvas
}

// ——— Étiquettes des sons perso ———

export const CUSTOM_COLORS = ['#1E8A7A', '#D24D7C', '#3557C9', '#C98A12', '#5E7A1E', '#B5442A']

function tinEdges(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 0, LABEL_W, 26)
  ctx.fillRect(0, LABEL_H - 24, LABEL_W, 24)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 26, LABEL_W, 6)
  ctx.fillRect(0, LABEL_H - 30, LABEL_W, 6)
}

/** Image plaquée sur tout le tour (remplissage recadré) ou, sans image, le nom répété. */
export function drawCustomLabel(canvas, { name, image, color }) {
  canvas.width = LABEL_W
  canvas.height = LABEL_H
  const ctx = canvas.getContext('2d')
  if (image) {
    const iw = image.width || image.naturalWidth
    const ih = image.height || image.naturalHeight
    const scale = Math.max(LABEL_W / iw, LABEL_H / ih)
    const w = iw * scale
    const h = ih * scale
    ctx.drawImage(image, (LABEL_W - w) / 2, (LABEL_H - h) / 2, w, h)
    tinEdges(ctx)
    return canvas
  }
  ctx.fillStyle = color
  ctx.fillRect(0, 0, LABEL_W, LABEL_H)
  ctx.fillStyle = 'rgba(255,255,255,0.09)'
  for (let y = 18; y < LABEL_H; y += 36) {
    for (let x = (y / 36) % 2 ? 18 : 36; x < LABEL_W; x += 36) {
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  tinEdges(ctx)
  // le nom, trois fois autour de la boîte (face, côté gauche, côté droit/dos)
  const text = name.toUpperCase()
  let size = 190
  ctx.font = `${size}px ${DISPLAY}`
  const max = 600
  const w = ctx.measureText(text).width
  if (w > max) size = Math.max(64, Math.floor((size * max) / w))
  ctx.font = `${size}px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ;[1024, 1024 - 683, 1024 + 683].forEach((x, i) => {
    ctx.save()
    ctx.translate(x, LABEL_H / 2)
    ctx.rotate(i === 0 ? -0.06 : 0.05)
    ctx.lineWidth = Math.max(10, size * 0.14)
    ctx.strokeStyle = '#15171A'
    ctx.strokeText(text, 0, 0)
    ctx.fillStyle = i === 0 ? '#FFE14A' : '#FFFFFF'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  })
  return canvas
}
