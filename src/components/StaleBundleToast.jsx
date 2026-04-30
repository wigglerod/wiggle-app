// StaleBundleToast — fired by freshBundle.assertFreshOrThrow when the
// running JS bundle does not match /version.json. Renders for ~1s and the
// caller (freshBundle.js) reloads the page. The reload IS the dismissal.

import { toast } from 'sonner'

const TOAST_DURATION_MS = 1000

export function showStaleBundleToast() {
  toast.custom(
    () => (
      <div
        role="status"
        style={{
          background: '#F5EDE4',
          color: '#111A14',
          border: '2px solid #E8634A',
          borderRadius: 12,
          padding: '14px 18px',
          fontFamily: 'Fraunces, serif',
          fontSize: 16,
          fontWeight: 600,
          boxShadow: '0 6px 24px rgba(17, 26, 20, 0.18)',
          minWidth: 280,
          textAlign: 'center',
        }}
      >
        App needs to refresh — reloading now…
      </div>
    ),
    { duration: TOAST_DURATION_MS, dismissible: false }
  )
}
