import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register SW with periodic update checks (every 60s)
// When a new version is detected, it auto-reloads
const updateSW = registerSW({
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      window.__swRegistration = registration
      setInterval(() => {
        registration.update()
      }, 60 * 1000)
    }
  },
  onNeedRefresh() {
    // Auto-apply the update immediately
    updateSW(true)
  },
})

console.log(`[Wiggle] v${__APP_VERSION__}`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
