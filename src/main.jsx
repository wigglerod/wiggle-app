import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register SW with periodic update checks (every 15 min)
// skipWaiting + clientsClaim in workbox config means new SW activates immediately
// Show banner so user knows to reload for the new version
const updateSW = registerSW({
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      window.__swRegistration = registration
      // Check for updates every 15 minutes
      setInterval(() => {
        registration.update()
      }, 15 * 60 * 1000)
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
