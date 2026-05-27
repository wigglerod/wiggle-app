import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'

/**
 * Hook for detecting online/offline status.
 * Returns { isOffline } and auto-syncs when coming back online.
 *
 * Wheel 2 Bug 1: also replay any queued actions on mount when already online
 * (e.g. PWA was killed offline mid-queue, reopened later on a good connection
 * — the `online` event never fires, so a mount-time replay is required).
 */
export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
      replayOfflineQueue()
    }
    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Replay on mount if we're already online and the queue is non-empty.
    // Don't gate on navigator.onLine alone — `online`/`offline` events only fire
    // on transitions, so a queue surviving a process death is invisible to the
    // listener.
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
        if (queue.length > 0) replayOfflineQueue()
      } catch {
        // ignore — queue read failures are handled inside replayOfflineQueue
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOffline }
}

// ── Offline Queue ──────────────────────────────────────────────────────
const QUEUE_KEY = 'wiggle_offline_queue'

// Wheel 2 Bug 2: race-safe drain. The old implementation read the queue into a
// local array, processed it, then called localStorage.removeItem(QUEUE_KEY)
// unconditionally — wiping any items enqueued mid-replay. Now each successful
// item is removed by id; failed items remain; concurrent enqueues survive.
//
// Item IDs are assigned on enqueue (the timestamp + a small random suffix to
// disambiguate same-millisecond enqueues, which happen in test).
let _replayInflight = null

export function enqueueOfflineAction(action) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    queue.push({ ...action, _id: id, timestamp: Date.now() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch (err) {
    console.warn('[offline] failed to queue action:', err.message)
  }
}

// EXEMPT from the writer-path freshness gate (OQ #27 / Option D, PR #11, and
// audit 2026-05-13 Finding #1 wiring). Replay runs queued user actions that
// were already authored against the previously running bundle; gating here
// would silently drop those actions when the post-throw page reload
// interrupts the loop. Fail-open by exemption — same reasoning as
// freshBundle.assertFreshBundle's network/parse fail-open.
//
// Single-flight: concurrent calls share the same in-flight promise.
async function replayOfflineQueue() {
  if (_replayInflight) return _replayInflight
  _replayInflight = (async () => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
      if (snapshot.length === 0) return

      // Process snapshot; collect ids that succeeded.
      const succeededIds = new Set()
      let synced = 0
      let failed = 0

      for (const action of snapshot) {
        try {
          if (action.type === 'upsert') {
            await supabase.from(action.table).upsert(action.data, action.options || {})
          } else if (action.type === 'insert') {
            // 23505 from a partial unique index is fine — the realtime echo of
            // the same row likely arrived between the offline tap and replay.
            // supabase-js does not throw on PostgrestError; the row is either
            // already there or this insert puts it there. Either way: synced.
            await supabase.from(action.table).insert(action.data)
          } else if (action.type === 'update') {
            let q = supabase.from(action.table).update(action.data)
            for (const [col, val] of Object.entries(action.filters || {})) {
              q = q.eq(col, val)
            }
            await q
          } else if (action.type === 'delete') {
            let q = supabase.from(action.table).delete()
            for (const [col, val] of Object.entries(action.filters || {})) {
              if (Array.isArray(val)) q = q.in(col, val)
              else q = q.eq(col, val)
            }
            await q
          }
          if (action._id) succeededIds.add(action._id)
          synced++
        } catch (err) {
          failed++
          console.error('[offline-replay] failed action:', action.type, action.table, err.message)
        }
      }

      // Drain succeeded items only — re-read the queue (it may have grown during
      // processing) and write back everything except the succeeded ids.
      // Items without _id (legacy queue rows pre-Wheel-2) are kept on the
      // pessimistic side: they'll get an _id on the next enqueue cycle or
      // be retried.
      try {
        const current = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
        const remaining = current.filter((a) => !(a._id && succeededIds.has(a._id)))
        if (remaining.length === 0) {
          localStorage.removeItem(QUEUE_KEY)
        } else {
          localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
        }
      } catch (err) {
        console.warn('[offline-replay] drain failed:', err.message)
      }

      if (synced > 0) toast.success(`Synced ${synced} change${synced > 1 ? 's' : ''}`)
      if (failed > 0) toast.error(`${failed} offline change${failed > 1 ? 's' : ''} failed to sync`)
    } catch (err) {
      console.error('[offline-replay] queue read failed:', err.message)
      toast.error('Failed to sync offline changes')
    } finally {
      _replayInflight = null
    }
  })()
  return _replayInflight
}

// ── Dogs Cache (localStorage) ──────────────────────────────────────────
const DOGS_CACHE_KEY = 'wiggle_dogs_cache'
const DOGS_CACHE_TS_KEY = 'wiggle_dogs_cache_ts'

export function getCachedDogs() {
  try {
    const data = localStorage.getItem(DOGS_CACHE_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function setCachedDogs(dogs) {
  try {
    localStorage.setItem(DOGS_CACHE_KEY, JSON.stringify(dogs))
    localStorage.setItem(DOGS_CACHE_TS_KEY, String(Date.now()))
  } catch {
    // localStorage full
  }
}
