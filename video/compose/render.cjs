// Renders the compositor to PNG frames.
//   npx electron video/compose/render.cjs                 -> video/build/frames/0000.png … (30 fps)
//   npx electron video/compose/render.cjs 1.9 8.5 21.9    -> video/build/preview/t_<sec>.png
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('fs')
const { join } = require('path')

const FPS = 30
const SECONDS = 30
const BUILD = join(__dirname, '..', 'build')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: { offscreen: true, webSecurity: false, backgroundThrottling: false }
  })
  await win.loadFile(join(__dirname, 'index.html'))
  const frame = async (t) => {
    const url = await win.webContents.executeJavaScript(`renderFrame(${t})`)
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
  }
  const times = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n))
  if (times.length) {
    mkdirSync(join(BUILD, 'preview'), { recursive: true })
    for (const t of times) writeFileSync(join(BUILD, 'preview', `t_${t.toFixed(2)}.png`), await frame(t))
  } else {
    const dir = join(BUILD, 'frames')
    mkdirSync(dir, { recursive: true })
    for (let i = 0; i < FPS * SECONDS; i++) {
      // Sample mid-frame so events on exact beat times land on the frame that contains them.
      writeFileSync(join(dir, `${String(i).padStart(4, '0')}.png`), await frame(i / FPS))
      if (i % 90 === 0) console.log(`frame ${i}`)
    }
  }
  console.log('done')
  app.quit()
})
