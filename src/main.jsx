import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register SW with periodic update checks (every 30 min)
// Shows a banner instead of auto-reloading mid-walk
const updateSW = registerSW({
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      window.__swRegistration = registration
      setInterval(() => {
        registration.update()
      }, 30 * 60 * 1000)
    }
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('wiggle-sw-update', { detail: updateSW }))
  },
})

console.log(`[Wiggle] v${__APP_VERSION__}`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
