// Clerkroom 30 s demo: every frame is drawn from the captured app states (../build/states, dark
// appearance) by renderFrame(t). 96 BPM: one beat = 0.625 s, one bar = 2.5 s, 12 bars. Cuts sit
// on bar lines; the last stroke of each handwritten card lands on a beat. Emphasis comes from
// spotlights (everything else dims), not arrows.
'use strict'

const W = 1920
const H = 1080
const BEAT = 0.625
const INK = '#fff6d5' // caption cards: a very pale yellow, in the app's typeface
const ACCENT = '#7aa7ff' // marks (waveform, circle, highlighter, clicks): the app's dark-mode focus blue
const CORAL = '#e46d6b' // the logo's heartbeat line only
const TEXT_DARK = '#eef1f5'
const CANVAS_DARK = '#1f252c'
const SANS = '"Plus Jakarta Sans", system-ui, sans-serif'

const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')
const veil = document.createElement('canvas')
veil.width = W
veil.height = H
const vctx = veil.getContext('2d')

// ---------- assets ----------

const IMG = {}
let META = null
let CLOCK = ''
const STATE_NAMES = ['library', 'library_hover', 'open_think', 'mic_idle', 'rec_0', 'rec_1', 'rec_2', 'rec_3', 'transcribing', 'reply_think', 'fb_top', 'fb_item']
const pad2 = (i) => String(i).padStart(2, '0')

async function loadAll() {
  META = await (await fetch('../build/states.json')).json()
  // The menu bar clock reads a minute before the recorded station starts, matching the app's dates.
  const { record } = await (await fetch('../recording.json')).json()
  const at = new Date(record.startedAt - 60_000)
  CLOCK = `${at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}  ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  const names = [...STATE_NAMES]
  for (let i = 1; i <= META.states.open_count; i++) names.push(`open_${pad2(i)}`)
  for (let i = 1; i <= META.states.q_count; i++) names.push(`q_${i}`)
  for (let i = 1; i <= META.states.reply_count; i++) names.push(`reply_${pad2(i)}`)
  await Promise.all(
    names.map(
      (n) =>
        new Promise((res, rej) => {
          const im = new Image()
          im.onload = () => res((IMG[n] = im))
          im.onerror = () => rej(new Error(n))
          im.src = `../build/states/${n}.png`
        })
    )
  )
  const art = (key, file) =>
    new Promise((res, rej) => {
      const im = new Image()
      im.onload = () => res((IMG[key] = im))
      im.onerror = () => rej(new Error(file))
      im.src = `../art/${file}`
    })
  await Promise.all([art('campus', 'campus.jpg'), art('walkers', 'walker-pair.png')])
  WALKER = { ...(await (await fetch('../art/walker.json')).json()), ...WALKER_LAYOUT }
  await document.fonts.load(`800 80px ${SANS}`)
  await document.fonts.load(`700 80px ${SANS}`)
  await document.fonts.load(`500 30px ${SANS}`)
  await document.fonts.load(`500 66px ${SANS}`)
}

// ---------- helpers ----------

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const lerp = (a, b, p) => a + (b - a) * p
const prog = (t, a, b) => clamp((t - a) / (b - a))
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const easeOut = (p) => 1 - Math.pow(1 - p, 3)
const streamed = (t, t0, t1, count) => clamp(Math.floor(prog(t, t0, t1) * count) + 1, 1, count)
const rectLerp = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) })

// ---------- camera ----------
// A camera is { x, y, z }: the world point (app window CSS px) at the frame centre, and the zoom.

function withCamera(cam, draw) {
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(cam.z, cam.z)
  ctx.translate(-cam.x, -cam.y)
  draw()
  ctx.restore()
}
const camLerp = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), z: lerp(a.z, b.z, p) })
const toScreen = (cam, x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2]
function toScreenRect(cam, r, pad = 0) {
  const [x, y] = toScreen(cam, r.x - pad, r.y - pad)
  return { x, y, w: (r.w + 2 * pad) * cam.z, h: (r.h + 2 * pad) * cam.z }
}
const FULL = { x: -80, y: -80, w: W + 160, h: H + 160 }

// ---------- the desktop and the app window ----------

function wallpaper(x0, y0, w, h) {
  const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h)
  g.addColorStop(0, '#18202b')
  g.addColorStop(0.5, '#232a3a')
  g.addColorStop(1, '#2a2533')
  ctx.fillStyle = g
  ctx.fillRect(x0, y0, w, h)
  const blob = (x, y, r, c) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, c)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
  blob(x0 + w * 0.2, y0 + h * 0.75, w * 0.35, 'rgba(44,74,96,0.75)')
  blob(x0 + w * 0.82, y0 + h * 0.25, w * 0.3, 'rgba(91,54,57,0.55)')
  blob(x0 + w * 0.6, y0 + h * 0.9, w * 0.25, 'rgba(68,61,99,0.5)')
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

/** Draws the app window (1200x800 CSS px at the world origin) showing a captured state. */
function appWindow(state) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 70
  ctx.shadowOffsetY = 26
  roundRect(ctx, 0, 0, 1200, 800, 12)
  ctx.fillStyle = CANVAS_DARK
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, 0, 0, 1200, 800, 12)
  ctx.clip()
  ctx.drawImage(IMG[state], 0, 0, 1200, 800)
  ;[['#ff5f57', 20], ['#febc2e', 40], ['#28c840', 60]].forEach(([c, x]) => {
    ctx.beginPath()
    ctx.arc(x, 28, 6, 0, Math.PI * 2)
    ctx.fillStyle = c
    ctx.fill()
  })
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  roundRect(ctx, 0.5, 0.5, 1199, 799, 12)
  ctx.stroke()
}

/** The app window on the desktop, seen through a camera. */
function appShot(cam, state, extraWorld) {
  ctx.fillStyle = CANVAS_DARK
  ctx.fillRect(0, 0, W, H)
  withCamera(cam, () => {
    wallpaper(-1400, -900, 4000, 2600)
    appWindow(state)
    if (extraWorld) extraWorld()
  })
}

// ---------- spotlight ----------

/** Dims the frame except a soft-edged rounded hole (screen coords). */
function spotlight(hole, alpha, radius = 28, soft = 26) {
  if (alpha <= 0) return
  vctx.clearRect(0, 0, W, H)
  vctx.globalCompositeOperation = 'source-over'
  vctx.filter = 'none'
  vctx.fillStyle = `rgba(6,8,13,${alpha})`
  vctx.fillRect(0, 0, W, H)
  vctx.globalCompositeOperation = 'destination-out'
  vctx.filter = `blur(${soft}px)`
  roundRect(vctx, hole.x, hole.y, hole.w, hole.h, radius)
  vctx.fillStyle = '#000'
  vctx.fill()
  vctx.filter = 'none'
  vctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(veil, 0, 0)
}

/** Irises in from the whole frame to `hole` over [t0, t0 + dur]. */
function irisIn(t, t0, hole, dur = 0.35, alpha = 0.66) {
  const p = easeOut(prog(t, t0, t0 + dur))
  spotlight(rectLerp(FULL, hole, p), alpha * p)
}

// ---------- cursor ----------

function cursor(x, y, size, pressed) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 20, size / 20)
  if (pressed > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, 10 + 16 * pressed, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(122,167,255,${0.95 * (1 - pressed)})`
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 17)
  ctx.lineTo(4.2, 13.2)
  ctx.lineTo(7.2, 19.6)
  ctx.lineTo(10, 18.4)
  ctx.lineTo(7.1, 12.2)
  ctx.lineTo(12.4, 12.2)
  ctx.closePath()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  ctx.fillStyle = '#111'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()
}
const clickRing = (t, tc) => (t >= tc && t < tc + 0.35 ? (t - tc) / 0.35 : 0)

// ---------- hand-drawn marks ----------

/** Draws the first p of a polyline in coral marker. */
function strokePoints(pts, p, width) {
  if (p <= 0 || pts.length < 2) return
  const lens = [0]
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const target = lens[lens.length - 1] * clamp(p)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] <= target) ctx.lineTo(pts[i][0], pts[i][1])
    else {
      const f = (target - lens[i - 1]) / (lens[i] - lens[i - 1])
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f))
      break
    }
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = ACCENT
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = width * 1.5
  ctx.stroke()
  ctx.restore()
}

/** A loose hand-drawn ellipse, as if circling something. */
function circleAround(t, t0, t1, cx, cy, rx, ry, width, seed) {
  const pts = []
  const n = 80
  for (let i = 0; i <= n; i++) {
    const a = -2.6 + (i / n) * Math.PI * 2.15
    const r = 1 + 0.04 * Math.sin(i * 0.3 + seed) + (i / n) * 0.06
    pts.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)])
  }
  strokePoints(pts, easeInOut(prog(t, t0, t1)), width)
}

/** A marker highlight swept across a rect (world coords), like a highlighter pen. */
function highlighter(t, t0, t1, r) {
  const p = easeInOut(prog(t, t0, t1))
  if (p <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = 'rgba(122,167,255,0.55)'
  ctx.beginPath()
  const skew = r.h * 0.18
  ctx.moveTo(r.x, r.y + skew)
  ctx.lineTo(r.x + r.w * p, r.y)
  ctx.lineTo(r.x + r.w * p - skew * 0.5, r.y + r.h)
  ctx.lineTo(r.x - skew * 0.3, r.y + r.h - skew * 0.4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ---------- captions ----------

/**
 * Sets a caption word by word between t0 and t1: each word rises into place over 0.14 s and the
 * last one lands exactly on t1 (a beat). Then it holds; captions cut, they never fade out.
 */
function write(t, t0, t1, text, x, y, size, align = 'left') {
  if (t < t0) return
  size = Math.round(size * 0.78)
  ctx.save()
  ctx.font = `800 ${size}px ${SANS}`
  ctx.letterSpacing = `${-0.01 * size}px`
  ctx.textBaseline = 'alphabetic'
  const words = text.split(' ')
  const space = ctx.measureText(' ').width
  const widths = words.map((w) => ctx.measureText(w).width)
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1)
  let wx = align === 'center' ? x - total / 2 : x
  const rise = 0.14
  const step = words.length > 1 ? (t1 - rise - t0) / (words.length - 1) : 0
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = size * 0.28
  ctx.shadowOffsetY = size * 0.05
  ctx.fillStyle = INK
  words.forEach((word, k) => {
    const p = easeOut(prog(t, t0 + k * step, t0 + k * step + rise))
    if (p > 0) {
      ctx.globalAlpha = p
      ctx.fillText(word, wx, y + (1 - p) * size * 0.28)
    }
    wx += widths[k] + space
  })
  ctx.restore()
}

// ---------- bar 1: two students ----------
// Artwork (FLUX.2 [klein] via QVAC, same style as the consulting room): video/art/campus.jpg and the
// students cut out by video/art/cutout.py into walker-pair.png (+ walker.json with its box).

let WALKER = null
/** Framing of the walkers and their bubbles, tuned to the artwork (frame px; source px for headY). */
const WALKER_LAYOUT = {
  scale: 1.35, // source px -> frame px
  headY: 85, // source y of the top of their heads
  top: 205, // where that lands in the frame
  shiftX: 0,
  bubbleLeft: { box: { x: 40, y: 60 }, tip: { x: 640, y: 330 } },
  bubbleRight: { box: { x: 1370, y: 110 }, tip: { x: 1300, y: 360 } }
}

/** An app-style speech bubble at box (x, y), its tail reaching sideways to `tip`; pops in at tPop. */
function speechBubble(t, tPop, lines, box, tip, fill, weight = 500) {
  const p = prog(t, tPop, tPop + 0.22)
  if (p <= 0) return
  const pop = 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2) // ease-out with a little overshoot
  const size = 66
  const lh = size * 1.28
  ctx.save()
  ctx.font = `${weight} ${size}px ${SANS}`
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 72
  const h = lines.length * lh + 44
  const tailRight = tip.x > box.x + w / 2
  ctx.translate(tip.x, tip.y)
  ctx.scale(pop, pop)
  ctx.translate(-tip.x, -tip.y)
  ctx.shadowColor = 'rgba(10,14,22,0.28)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 10
  ctx.fillStyle = fill
  roundRect(ctx, box.x, box.y, w, h, 32)
  ctx.fill()
  const ex = tailRight ? box.x + w - 2 : box.x + 2
  const ey = box.y + h * 0.62
  ctx.beginPath()
  ctx.moveTo(ex, ey - 26)
  ctx.lineTo(tip.x, tip.y)
  ctx.lineTo(ex, ey + 20)
  ctx.closePath()
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#1b2232'
  ctx.textBaseline = 'top'
  lines.forEach((l, k) => ctx.fillText(l, box.x + 36, box.y + 24 + k * lh))
  ctx.restore()
}

/**
 * A walk-and-talk: the two students walk towards the camera, framed from the waist up, while the
 * campus recedes behind them (slightly soft, for depth). Each takes a step on every beat.
 */
function sceneStudents(t) {
  // The camera backs away down the path as they walk towards it: the campus recedes slowly
  // toward the path's vanishing point, with a slight drift.
  const bg = IMG.campus
  const k = lerp(1.16, 1.0, t / 2.5)
  const sb = (H / bg.height) * 1.1 * k
  const bw = bg.width * sb
  const bh = bg.height * sb
  const vp = { x: 0.43 * bg.width * sb, y: 0.66 * bg.height * sb } // where the path meets the building
  const bx = clamp(W * 0.5 - vp.x - 30 * (t / 2.5), W - bw, 0)
  const by = clamp(H * 0.62 - vp.y, H - bh, 0)
  ctx.save()
  ctx.filter = 'blur(3px)'
  ctx.drawImage(bg, bx, by, bw, bh)
  ctx.restore()
  // The pair, waist-up: a rise on every step (one per beat), a gentle sway, and very slowly nearer.
  const wm = WALKER
  const box = wm.pair
  const step = Math.abs(Math.sin((Math.PI * t) / BEAT))
  const s = wm.scale * lerp(1, 1.025, t / 2.5)
  const pw = (box[2] - box[0]) * s
  const ph = (box[3] - box[1]) * s
  const x = W / 2 - pw / 2 + wm.shiftX
  const y = wm.top - (wm.headY - box[1]) * s - 14 * step
  ctx.save()
  ctx.translate(W / 2, H + 200)
  ctx.rotate(0.6 * Math.sin((Math.PI * t) / BEAT / 2) * (Math.PI / 180))
  ctx.translate(-W / 2, -(H + 200))
  ctx.shadowColor = 'rgba(20,28,45,0.3)'
  ctx.shadowBlur = 40
  ctx.drawImage(IMG.walkers, x, y, pw, ph)
  ctx.restore()
  speechBubble(t, 0.02, ['I don’t know', 'who to practise', 'my OSCE with…'], wm.bubbleLeft.box, wm.bubbleLeft.tip, '#ffffff')
  speechBubble(t, 1.25, ['Do you know', 'Clerkroom?'], wm.bubbleRight.box, wm.bubbleRight.tip, '#faefcb', 700)
}

// ---------- bar 2: Wi-Fi off, then the library ----------

const MB = 30 // menu bar height (desktop coords)
const WIFI_X = 1640
const WIN = { x: 160, y: 360 } // the Clerkroom window's position on the desktop
const MENU = { x: WIFI_X - 250, y: MB + 6, w: 290, h: 112 }
const T_OPEN = 2.5 + BEAT / 2 // clicks the Wi-Fi icon
const T_OFF = 2.5 + BEAT // switches it off (on a beat)
const T_PULL = 3.45 // the camera pulls back to the app
const T_START = 4.375 // clicks "Start station"

function toggle(x, y, k) {
  ctx.save()
  roundRect(ctx, x, y, 38, 22, 11)
  ctx.fillStyle = k > 0.5 ? '#3a6fd8' : '#4a5260'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 11 + 16 * k, y + 11, 9, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 3
  ctx.fill()
  ctx.restore()
}

function menuWifiGlyph(x, y, on) {
  ctx.save()
  ctx.strokeStyle = on ? TEXT_DARK : 'rgba(238,241,245,0.35)'
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  for (const r of [4.5, 8.5, 12.5]) {
    ctx.beginPath()
    ctx.arc(x, y + 6, r, -Math.PI * 0.77, -Math.PI * 0.23)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x, y + 6, 1.4, 0, Math.PI * 2)
  ctx.fill()
  if (!on) {
    ctx.strokeStyle = TEXT_DARK
    ctx.beginPath()
    ctx.moveTo(x - 9, y - 6)
    ctx.lineTo(x + 9, y + 8)
    ctx.stroke()
  }
  ctx.restore()
}

function desktopCursor(t) {
  const r = META.rects.chestStart
  const card = META.rects.chestCard
  const start = [WIN.x + r.x + r.w * 0.55, WIN.y + r.y + r.h * 0.6]
  const p1 = easeInOut(prog(t, 2.5, T_OPEN - 0.03))
  const p2 = easeInOut(prog(t, T_OPEN + 0.08, T_OFF - 0.05))
  const p3 = easeInOut(prog(t, T_PULL + 0.05, T_START - 0.12))
  const x = lerp(lerp(lerp(1560, WIFI_X + 2, p1), MENU.x + 255, p2), start[0], p3)
  const y = lerp(lerp(lerp(120, 16, p1), MENU.y + 26, p2), start[1], p3)
  const cx = x - WIN.x
  const cy = y - WIN.y
  return { x, y, onCard: cx > card.x && cx < card.x + card.w && cy > card.y && cy < card.y + card.h }
}

function desktop(t, off, menuOpen, knob) {
  wallpaper(-600, -400, 3120, 1880)
  ctx.save()
  ctx.translate(WIN.x, WIN.y)
  appWindow(desktopCursor(t).onCard ? 'library_hover' : 'library')
  ctx.restore()
  // Menu bar (dark).
  ctx.fillStyle = 'rgba(28,32,40,0.9)'
  ctx.fillRect(-600, 0, 3120, MB)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(-600, MB, 3120, 1)
  ctx.fillStyle = TEXT_DARK
  ctx.font = `700 14px ${SANS}`
  ctx.textBaseline = 'middle'
  ctx.fillText('Clerkroom', 22, MB / 2 + 1)
  ctx.font = `500 14px ${SANS}`
  ;['File', 'Edit', 'View', 'Window', 'Help'].forEach((m, i) => ctx.fillText(m, 96 + i * 62, MB / 2 + 1))
  ctx.textAlign = 'right'
  ctx.fillText(CLOCK, 1900, MB / 2 + 1)
  ctx.textAlign = 'left'
  ctx.strokeStyle = TEXT_DARK
  ctx.lineWidth = 1.2
  roundRect(ctx, 1680, 9, 24, 12, 3)
  ctx.stroke()
  ctx.fillStyle = TEXT_DARK
  ctx.fillRect(1682.5, 11.5, 15, 7)
  ctx.fillRect(1705, 13, 2, 4)
  if (menuOpen) {
    roundRect(ctx, WIFI_X - 16, 3, 32, 24, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.fill()
  }
  menuWifiGlyph(WIFI_X, 9, !off)
  if (menuOpen) {
    const m = MENU
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 26
    ctx.shadowOffsetY = 8
    roundRect(ctx, m.x, m.y, m.w, m.h, 12)
    ctx.fillStyle = 'rgba(44,49,60,0.98)'
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = TEXT_DARK
    ctx.font = `700 14px ${SANS}`
    ctx.fillText('Wi‑Fi', m.x + 16, m.y + 26)
    toggle(m.x + 236, m.y + 15, 1 - knob)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(m.x + 14, m.y + 48, 262, 1)
    ctx.font = `500 13px ${SANS}`
    ctx.fillStyle = off ? 'rgba(195,201,211,0.55)' : '#c3c9d3'
    ctx.fillText(off ? 'Wi‑Fi is off' : 'Home network', m.x + 16, m.y + 70)
    ctx.fillStyle = '#c3c9d3'
    ctx.fillText('Wi‑Fi Settings…', m.x + 16, m.y + 96)
  }
  ctx.textBaseline = 'alphabetic'
}

function sceneWifi(t) {
  const off = t >= T_OFF
  const menuOpen = t >= T_OPEN && t < T_PULL + 0.1
  const knob = clamp((t - T_OFF) / 0.12)
  const card = META.rects.chestCard
  const near = { x: 1420, y: 150, z: 2.3 }
  const app = { x: WIN.x + card.x + card.w / 2 - 40, y: WIN.y + card.y + card.h / 2, z: 1.75 }
  const cam = camLerp(near, app, easeInOut(prog(t, T_PULL, T_PULL + 0.75)))
  ctx.fillStyle = CANVAS_DARK
  ctx.fillRect(0, 0, W, H)
  withCamera(cam, () => {
    desktop(t, off, menuOpen, knob)
    const c = desktopCursor(t)
    cursor(c.x, c.y, 16, Math.max(clickRing(t, T_OPEN), clickRing(t, T_OFF), clickRing(t, T_START)))
  })
  // Spotlight the Wi-Fi icon and menu as it goes off; it lets go as the camera pulls back.
  const hole = toScreenRect(cam, { x: MENU.x - 6, y: 0, w: WIFI_X + 30 - MENU.x, h: MENU.y + MENU.h + 8 }, 10)
  const a = t < T_PULL ? easeOut(prog(t, T_OFF - 0.05, T_OFF + 0.25)) : 1 - prog(t, T_PULL, T_PULL + 0.35)
  if (a > 0) spotlight(hole, 0.62 * a, 24)
}

// ---------- bar 3: the consultation opens ----------

function sceneOpening(t) {
  const n = META.states.open_count
  const state = t < 5.3 ? 'open_think' : `open_${pad2(streamed(t, 5.3, 6.7, n))}`
  const cam = camLerp({ x: 600, y: 450, z: 1.62 }, { x: 610, y: 450, z: 1.72 }, easeInOut(prog(t, 5, 7.5)))
  appShot(cam, state)
  // Spotlight David: his reply and the patient in the room (the right-hand figure).
  const b = META.rects[`open_${pad2(n)}`]
  const room = META.rects.room
  const x0 = Math.min(b.x, room.x + room.w * 0.54)
  const y0 = b.y - 20
  const hole = { x: x0, y: y0, w: room.x + room.w - x0, h: room.y + room.h - y0 }
  irisIn(t, 5.0, toScreenRect(cam, hole, 8), 0.4)
  write(t, 5.0, 5.36, 'Your OSCE', 80, 590, 116)
  write(t, 5.36, 5.625 - 0.02, 'patient.', 80, 720, 116)
  write(t, 6.25, 6.875 - 0.02, 'On your Mac.', 80, 930, 104)
}

// ---------- bars 4-6: voice input ----------

const VOICE_CAM_A = { x: 600, y: 470, z: 1.62 }
const VOICE_CAM_B = { x: 560, y: 500, z: 1.76 }

function sceneVoice(t) {
  const tClick = 7.5 + BEAT / 2
  const tStop = 10.3125
  let state = 'mic_idle'
  if (t >= tClick) state = ['rec_0', 'rec_1', 'rec_2', 'rec_3'][clamp(Math.floor((t - tClick) / 0.625), 0, 3)]
  if (t >= tStop) state = 'transcribing'
  const qStart = 11.25
  const qn = META.states.q_count
  if (t >= qStart) state = `q_${clamp(Math.floor((t - qStart) / 0.25) + 1, 1, qn)}`
  const cam = camLerp(VOICE_CAM_A, VOICE_CAM_B, easeInOut(prog(t, 7.5, 15)))
  const mic = META.rects.mic
  const input = META.rects.input
  const send = META.rects.send
  appShot(cam, state, () => {
    const pc = easeInOut(prog(t, 13.1, 14.6))
    const x = t < 10.6 ? mic.x + mic.w / 2 + 6 : lerp(mic.x + mic.w / 2 + 6, send.x + send.w / 2 + 2, pc)
    const y = t < 10.6 ? mic.y + mic.h / 2 + 4 : lerp(mic.y + mic.h / 2 + 4, send.y + send.h / 2 + 3, pc)
    cursor(x, y, 18, Math.max(clickRing(t, tClick), clickRing(t, tStop)))
  })
  // Spotlight: the composer, plus the space above it where the voice is drawn.
  const hole = toScreenRect(cam, { x: mic.x, y: 612, w: input.x + input.w - mic.x, h: input.y + input.h - 612 }, 14)
  irisIn(t, 7.5, hole)
  // Listening: a live waveform rising out of the composer while recording.
  if (t >= tClick && t < tStop) {
    const [x0, yc] = toScreen(cam, input.x + 30, 668)
    const [x1] = toScreen(cam, input.x + input.w - 30, 668)
    waveform(t, x0, yc, x1 - x0, 58 * prog(t, tClick, tClick + 0.25) * (1 - prog(t, tStop - 0.2, tStop)))
  }
  write(t, 8.125, 8.75 - 0.02, 'Parakeet 0.6B hears you', W / 2, 250, 112, 'center')
}

function waveform(t, x0, yc, w, amp) {
  if (amp <= 0) return
  const bars = 46
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 9
  ctx.shadowColor = 'rgba(122,167,255,0.6)'
  ctx.shadowBlur = 16
  for (let i = 0; i < bars; i++) {
    const u = i / (bars - 1)
    const x = x0 + u * w
    const env = Math.pow(Math.sin(u * Math.PI), 0.7)
    // Syllable-like bursts: a moving envelope over fast jitter.
    const syll = 0.35 + 0.65 * Math.abs(Math.sin(t * 5.2 + u * 3.1))
    const v = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + i * 1.9) * Math.cos(t * 7.3 + i * 0.6))
    const h = Math.max(4, amp * env * syll * v)
    ctx.beginPath()
    ctx.moveTo(x, yc - h)
    ctx.lineTo(x, yc + h)
    ctx.stroke()
  }
  ctx.restore()
}

// ---------- bars 7-8: the patient replies ----------

const REPLY_CAM_A = { x: 600, y: 450, z: 1.62 }
const REPLY_CAM_B = { x: 590, y: 430, z: 1.78 }

function replyState(t) {
  const n = META.states.reply_count
  if (t < 15.3125) return 'q_' + META.states.q_count
  if (t < 15.9375) return 'reply_think'
  return `reply_${pad2(streamed(t, 15.9375, 19.3, n))}`
}

function sceneReply(t, freeze = false) {
  const tClick = 15.3125
  const send = META.rects.send
  const input = META.rects.input
  const cam = freeze ? REPLY_CAM_B : camLerp(REPLY_CAM_A, REPLY_CAM_B, easeInOut(prog(t, 15, 20)))
  const state = freeze ? `reply_${pad2(META.states.reply_count)}` : replyState(t)
  appShot(cam, state, () => {
    if (!freeze && t < 16.2) cursor(send.x + send.w / 2 + 2, send.y + send.h / 2 + 3, 18, clickRing(t, tClick))
  })
  if (freeze) return
  // The spotlight moves from the question to David's reply and grows with it.
  const r = META.rects[state] ?? input
  const bubble = { x: r.x, y: r.y - 20, w: r.w, h: r.h + 20 } // include the "David" label
  const from = toScreenRect(cam, input, 12)
  const hole = t < tClick ? from : rectLerp(from, toScreenRect(cam, bubble, 16), easeOut(prog(t, tClick, tClick + 0.4)))
  spotlight(hole, 0.66)
  write(t, 16.25, 16.875 - 0.02, 'MedPsy‑4B plays the patient', W / 2, 1005, 112, 'center')
}

// ---------- bar 9: the freeze ----------

function sceneFreeze(t) {
  sceneReply(t, true)
  ctx.fillStyle = 'rgba(8,10,16,0.6)' // about 40% brightness
  ctx.fillRect(0, 0, W, H)
  write(t, 20.0, 20.625 - 0.02, '2 QVAC models.', W / 2, 480, 160, 'center')
  write(t, 21.25, 21.875 - 0.02, '0 cloud.', W / 2, 700, 190, 'center')
}

// ---------- bars 10-11: feedback ----------

function sceneFeedbackItem(t) {
  const it = META.rects.item
  const q = META.rects.quote
  const cam = camLerp({ x: it.x + it.w * 0.5, y: it.y + it.h / 2 + 40, z: 1.5 }, { x: q.x + q.w * 0.6, y: q.y + 10, z: 1.9 }, easeInOut(prog(t, 22.5, 25)))
  appShot(cam, 'fb_item', () => highlighter(t, 23.125, 23.75 - 0.02, { x: q.x + 10, y: q.y + 3, w: q.w - 136, h: q.h - 6 }))
  irisIn(t, 22.5, toScreenRect(cam, it, 10))
  write(t, 23.75, 24.375 - 0.02, 'Every mark backed by your transcript.', W / 2, 1000, 104, 'center')
}

function sceneFeedbackPass(t) {
  const g = META.rects.gauge
  const n = META.rects.gaugeNum
  const cam = camLerp({ x: n.x + n.w / 2 + 40, y: n.y + 10, z: 1.9 }, { x: n.x + n.w / 2 + 30, y: n.y + 16, z: 2.3 }, easeInOut(prog(t, 25, 27.5)))
  appShot(cam, 'fb_top', () => circleAround(t, 25.3125, 25.9375 - 0.02, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.62, g.h * 1.25, 3.2, 4))
  spotlight(toScreenRect(cam, { x: n.x - 10, y: n.y - 130, w: n.w + 20, h: 210 }, 10), 0.66, 60)
  write(t, 0, 0.001, 'Every mark backed by your transcript.', W / 2, 1000, 104, 'center') // held from the previous shot
}

// ---------- bar 12: end card ----------

const LOGO_BUBBLE = new Path2D('M6 4h16a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-8l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z')
const LOGO_PULSE = new Path2D('M7 13h4l2-4 3 8 2-4h3')

function sceneEnd(t) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#1b2029')
  g.addColorStop(1, '#272e37')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 300, 0, W / 2, 300, 700)
  glow.addColorStop(0, 'rgba(122,167,255,0.12)')
  glow.addColorStop(1, 'rgba(122,167,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.font = `700 124px ${SANS}`
  const word = ctx.measureText('Clerkroom').width
  const s = 6.4
  const x0 = (W - (28 * s + 36 + word)) / 2
  const y0 = 170
  ctx.save()
  ctx.translate(x0, y0)
  ctx.scale(s, s)
  ctx.fillStyle = '#2c4a60'
  ctx.fill(LOGO_BUBBLE)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = TEXT_DARK
  ctx.lineWidth = 1.8
  ctx.stroke(LOGO_BUBBLE)
  ctx.strokeStyle = CORAL
  ctx.lineWidth = 2
  ctx.stroke(LOGO_PULSE)
  ctx.restore()
  ctx.fillStyle = TEXT_DARK
  ctx.textBaseline = 'middle'
  ctx.fillText('Clerkroom', x0 + 28 * s + 36, y0 + 14 * s)
  ctx.textBaseline = 'alphabetic'
  write(t, 27.5, 28.125 - 0.02, 'Offline. Private. Open source.', W / 2, 640, 116, 'center')
  write(t, 28.75, 29.375 - 0.02, 'MedPsy‑4B + Parakeet 0.6B by QVAC', W / 2, 800, 86, 'center')
  ctx.font = `500 30px ${SANS}`
  ctx.fillStyle = '#c3c9d3'
  ctx.textAlign = 'center'
  ctx.fillText('Educational simulation only · not a medical device', W / 2, 1010)
  ctx.textAlign = 'left'
}

// ---------- the edit ----------

function renderAt(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, W, H)
  if (t < 2.5) sceneStudents(t)
  else if (t < 5.0) sceneWifi(t)
  else if (t < 7.5) sceneOpening(t)
  else if (t < 15.0) sceneVoice(t)
  else if (t < 20.0) sceneReply(t)
  else if (t < 22.5) sceneFreeze(t)
  else if (t < 25.0) sceneFeedbackItem(t)
  else if (t < 27.5) sceneFeedbackPass(t)
  else sceneEnd(t)
}

const ready = loadAll()
window.renderFrame = async (t) => {
  await ready
  renderAt(t)
  return canvas.toDataURL('image/png')
}
