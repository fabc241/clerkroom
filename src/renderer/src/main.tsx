import './assets/main.css'
import { createRoot } from 'react-dom/client'
import Root from './Root'

async function boot(): Promise<void> {
  // Browser preview during development only; the packaged app always has the preload API.
  if (import.meta.env.DEV && !('clerkroom' in window)) (await import('./dev/mockApi')).installMockApi()
  // No StrictMode: it double-invokes effects, which would start model loads and sessions twice.
  createRoot(document.getElementById('root')!).render(<Root />)
}

void boot()
