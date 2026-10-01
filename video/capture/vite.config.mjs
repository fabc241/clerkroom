// Serves the real renderer on its own (no Electron main process) for the video capture.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = resolve(import.meta.dirname, '../..')
export default defineConfig({
  root: resolve(root, 'src/renderer'),
  resolve: { alias: { '@shared': resolve(root, 'src/shared'), '@renderer': resolve(root, 'src/renderer/src') } },
  plugins: [react(), tailwindcss()],
  server: { port: 5199, strictPort: true, fs: { allow: [root] } }
})
