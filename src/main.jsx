import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register SW with aggressive update checks
// skipWaiting + clientsClaim in workbox config means new SW activates immediately
// controllerchange listener below reloads page when that happens
const updateSW = registerSW({
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    window.__swRegistration = registration

    // Check for updates immediately on load
    registration.update()

    // Check every 5 minutes while app is open
    setInterval(() => {
      registration.update()
    }, 5 * 60 * 1000)

    // Check when app comes back to foreground (critical for iOS/Safari PWAs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update()
      }
    })
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('wiggle-sw-update', { detail: updateSW }))
  },
})

// Safety net: if a new SW takes control (via skipWaiting), reload to use new code
let refreshing = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (refreshing) return
  refreshing = true
  window.location.reload()
})

console.log(`[Wiggle] v${__APP_VERSION__} - [v4.0.0-robust-final]`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
