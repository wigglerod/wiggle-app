import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'

/**
 * Hook for detecting online/offline status.
 * Returns { isOffline } and auto-syncs when coming back online.
 */
export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
      // Replay any queued offline operations
      replayOfflineQueue()
    }
    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOffline }
}

// ── Offline Queue ──────────────────────────────────────────────────────
const QUEUE_KEY = 'wiggle_offline_queue'

export function enqueueOfflineAction(action) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    queue.push({ ...action, timestamp: Date.now() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch (err) {
    console.warn('[offline] failed to queue action:', err.message)
  }
}

async function replayOfflineQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    if (queue.length === 0) return

    let synced = 0
    let failed = 0

    for (const action of queue) {
      try {
        if (action.type === 'upsert') {
          await supabase.from(action.table).upsert(action.data, action.options || {})
          synced++
        } else if (action.type === 'update') {
          let q = supabase.from(action.table).update(action.data)
          for (const [col, val] of Object.entries(action.filters || {})) {
            q = q.eq(col, val)
          }
          await q
          synced++
        }
      } catch (err) {
        failed++
        console.error('[offline-replay] failed action:', action.type, action.table, err.message)
      }
    }

    localStorage.removeItem(QUEUE_KEY)
    if (synced > 0) {
      toast.success(`Synced ${synced} change${synced > 1 ? 's' : ''}`)
    }
    if (failed > 0) {
      toast.error(`${failed} offline change${failed > 1 ? 's' : ''} failed to sync`)
    }
  } catch (err) {
    console.error('[offline-replay] queue read failed:', err.message)
    toast.error('Failed to sync offline changes')
  }
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
