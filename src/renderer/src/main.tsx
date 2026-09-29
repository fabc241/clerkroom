import './assets/main.css'
import { createRoot } from 'react-dom/client'
import App from './App'

// No StrictMode: it double-invokes effects, which would start model loads and sessions twice.
createRoot(document.getElementById('root')!).render(<App />)
