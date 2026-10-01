// Captures every screen state the video needs from the real renderer, at 2x.
//   npx vite --config video/capture/vite.config.mjs   (in another terminal)
//   npx electron video/capture/main.cjs
// Writes video/build/states/*.png and video/build/states.json (element rects in CSS px).
const { app, BrowserWindow, nativeTheme } = require('electron')
const { mkdirSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const URL = 'http://localhost:5199/'
const W = 1200
const H = 800
const OUT = join(__dirname, '..', 'build', 'states')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// English dates for an English-speaking audience.
app.commandLine.appendSwitch('lang', 'en-GB')

app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true })
  nativeTheme.themeSource = 'dark'
  // Offscreen at zoom 2: a 1200x800 CSS viewport rendered at 2400x1600.
  const win = new BrowserWindow({
    width: W * 2,
    height: H * 2,
    useContentSize: true,
    show: false,
    webPreferences: { offscreen: true, zoomFactor: 2, preload: join(__dirname, 'preload.cjs'), contextIsolation: false, sandbox: false, backgroundThrottling: false }
  })
  const meta = { size: { w: W, h: H }, states: {}, rects: {} }
  const js = (code) => win.webContents.executeJavaScript(code)

  const load = async (hash) => {
    console.log('load', hash?.name ?? 'library')
    await win.loadURL(URL + `?n=${Date.now()}` + (hash ? `#${encodeURIComponent(JSON.stringify(hash))}` : ''))
    win.webContents.setZoomFactor(2)
    await js('document.fonts.ready.then(() => true)')
    await sleep(900)
  }
  const shot = async (name) => {
    const img = await win.webContents.capturePage()
    writeFileSync(join(OUT, `${name}.png`), img.toPNG())
    meta.states[name] = true
    process.stdout.write(`${name} `)
  }
  // Rect of the first element matching a selector (optionally containing text).
  const rect = async (name, selector, text) => {
    const r = await js(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
      const el = els.find((e) => ${JSON.stringify(text ?? '')} === '' || e.textContent.includes(${JSON.stringify(text ?? '')}))
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    })()`)
    if (!r) throw new Error(`No element for ${name}`)
    meta.rects[name] = r
    return r
  }
  const setInput = (v) =>
    js(`(() => {
      const t = document.getElementById('say')
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(v)})
      t.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
  const lastBubble = () =>
    js(`(() => { const b = [...document.querySelectorAll('.bubble-them')].at(-1).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } })()`)
  const stream = async (prefix, text, settle) => {
    const words = text.split(' ')
    for (let i = 0; i < words.length; i++) {
      await js(`__video.emit({ type: 'delta', text: ${JSON.stringify(words[i] + (i < words.length - 1 ? ' ' : ''))} })`)
      await sleep(settle)
      const name = `${prefix}_${String(i + 1).padStart(2, '0')}`
      await shot(name)
      meta.rects[name] = await lastBubble()
    }
    meta.states[`${prefix}_count`] = words.length
  }

  const rec = JSON.parse(readFileSync(join(__dirname, '..', 'recording.json'), 'utf8'))
  const said = rec.record.transcript.filter((e) => e.kind === 'candidate').map((e) => e.text)
  const replies = rec.record.transcript.filter((e) => e.kind === 'patient').map((e) => e.text)

  // 1. Station library.
  await load(null)
  await js(`[...document.querySelectorAll('main li')].find((l) => l.querySelector('h2')?.textContent === 'Chest pain').scrollIntoView({ block: 'center' })`)
  await sleep(300)
  await shot('library')
  const card = await js(`(() => {
    const li = [...document.querySelectorAll('main li')].find((l) => l.querySelector('h2')?.textContent === 'Chest pain')
    const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } }
    return { card: r(li), start: r([...li.querySelectorAll('button')].find((b) => b.textContent.includes('Start station'))) }
  })()`)
  meta.rects.chestCard = card.card
  meta.rects.chestStart = card.start
  const hx = card.start.x + card.start.w / 2
  const hy = card.start.y + card.start.h / 2
  win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(hx * 2), y: Math.round(hy * 2) })
  await sleep(450)
  await shot('library_hover')

  // 2. Consultation: the greeting, then David's opening line streams in.
  const session = await js(`window.digipat.startSession('med-chest-pain')`)
  await load({ name: 'encounter', stationId: 'med-chest-pain', session: { ...session, startedAt: Date.now() - 9_000 } })
  await shot('enc_empty')
  await setInput(said[0])
  await sleep(200)
  await js(`document.querySelector('[aria-label="Send"]').click()`)
  await sleep(700)
  await shot('open_think')
  meta.rects.open_think = await lastBubble()
  await stream('open', replies[0], 350)
  await js(`__video.emit({ type: 'done', text: ${JSON.stringify(replies[0])}, disclosedTopics: [] })`)
  await sleep(900)

  // 3. Voice input: record, transcribe with Parakeet's real result.
  await js(`document.getElementById('say').blur()`)
  await sleep(300)
  await shot('mic_idle')
  await rect('mic', '[aria-label="Dictate"]')
  await rect('input', '#say')
  await js(`document.querySelector('[aria-label="Dictate"]').click()`)
  await sleep(250)
  await shot('rec_0')
  await rect('stop', '[aria-label="Stop recording and transcribe"]')
  for (const s of [1, 2, 3]) {
    await sleep(1000)
    await shot(`rec_${s}`)
  }
  await js(`document.querySelector('[aria-label="Stop recording and transcribe"]').click()`)
  await sleep(400)
  await shot('transcribing')
  const qWords = rec.question.split(' ')
  for (let i = 1; i < qWords.length; i++) {
    await setInput(qWords.slice(0, i).join(' '))
    await sleep(120)
    await shot(`q_${i}`)
  }
  await setInput('')
  await js('__video.finishTranscribe()')
  await sleep(500)
  await shot(`q_${qWords.length}`)
  meta.states.q_count = qWords.length
  await rect('send', '[aria-label="Send"]')

  // 4. Send, and the reply streams in.
  await js(`document.querySelector('[aria-label="Send"]').click()`)
  await sleep(800)
  await shot('reply_think')
  meta.rects.reply_think = await lastBubble()
  await stream('reply', replies[1], 420)
  const last = await js(`(() => { const b = [...document.querySelectorAll('.bubble-them')].at(-1).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } })()`)
  meta.rects.replyBubble = last
  await rect('room', '.room')

  // 5. Feedback.
  await load({ name: 'feedback', sessionId: 'video' })
  await js(`document.querySelector('main').scrollTo(0, 0)`)
  await sleep(400)
  await shot('fb_top')
  await rect('gauge', 'span.font-bold', 'Passed')
  await rect('gaugeNum', 'div.num', '%')
  await js(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Review full detailed report')).click()`)
  await sleep(600)
  await js(`[...document.querySelectorAll('li')].find((l) => l.textContent.includes('Asks about family history') && l.querySelector('button')).scrollIntoView({ block: 'center' })`)
  await sleep(700)
  await shot('fb_item')
  await rect('item', 'ul.divide-y > li', 'Asks about family history')
  await rect('quote', 'li button', 'Does anyone in your family')

  writeFileSync(join(OUT, '..', 'states.json'), JSON.stringify(meta, null, 2))
  console.log('\ndone')
  app.quit()
})
