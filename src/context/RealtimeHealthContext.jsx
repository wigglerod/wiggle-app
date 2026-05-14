import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

// Publishes `lastResyncAt` to consuming hooks so they can re-run their initial
// load() when the realtime layer recovers (visibility return / pageshow /
// focus / active probe). See REALTIME_AUDIT_2026-05-13.md HIGH #2.
//
// Debounce: bumpResync ignores calls within 2s of the previous bump. Multiple
// triggers can fire on the same wake-up (visibilitychange + focus + probe),
// and we only need one refetch per wake.

const RealtimeHealthContext = createContext(null)

const DEBOUNCE_MS = 2000

export function RealtimeHealthProvider({ children }) {
  const [lastResyncAt, setLastResyncAt] = useState(0)
  const lastBumpRef = useRef(0)

  const bumpResync = useCallback(() => {
    const now = Date.now()
    if (now - lastBumpRef.current < DEBOUNCE_MS) return
    lastBumpRef.current = now
    setLastResyncAt(now)
  }, [])

  const value = useMemo(() => ({ lastResyncAt, bumpResync }), [lastResyncAt, bumpResync])

  return <RealtimeHealthContext.Provider value={value}>{children}</RealtimeHealthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtimeHealth() {
  const ctx = useContext(RealtimeHealthContext)
  if (!ctx) throw new Error('useRealtimeHealth must be used within RealtimeHealthProvider')
  return ctx
}
