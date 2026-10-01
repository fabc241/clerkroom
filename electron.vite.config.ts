import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

// The dev server's hot reload needs a WebSocket; the packaged app connects nowhere, so its CSP drops it.
const productionCsp = {
  name: 'production-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string): string => html.replace(' ws://localhost:*', '')
}

export default defineConfig({
  main: {
    resolve: { alias: shared },
    build: { outDir: 'dist/main' }
  },
  preload: {
    resolve: { alias: shared },
    build: {
      outDir: 'dist/preload',
      // Sandboxed preload scripts must be CommonJS.
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } }
    }
  },
  renderer: {
    resolve: { alias: { ...shared, '@renderer': resolve('src/renderer/src') } },
    build: { outDir: 'dist/renderer', minify: true },
    plugins: [react(), tailwindcss(), productionCsp]
  }
})
