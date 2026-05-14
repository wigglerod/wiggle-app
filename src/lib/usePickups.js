import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { subscribeShared } from './sharedRealtimeChannel'
import { assertFreshOrThrow, StaleBundleError } from './freshBundle'
import { enqueueOfflineAction } from './useOffline'
import { useAuth } from '../context/AuthContext'
import { useRealtimeHealth } from '../context/RealtimeHealthContext'

// Audit 2026-05-13 Finding #1 — distinguish transport-level failures (queue +
// keep optimistic) from real DB errors (rollback + toast). Only transport-level
// counts as "offline" here: navigator.onLine === false, OR the supabase error
// has no error.code (PostgrestError shape with code='' or undefined) AND looks
// like a network failure (no details/hint either). 23505 / RLS (42501) /
// schema (42703) etc. are NEVER queued — those are real DB errors.
function isTransportFailure(error) {
  if (!navigator.onLine) return true
  if (!error) return false
  if (error.code) return false
  if (error.details || error.hint) return false
  const msg = (error.message || '').toLowerCase()
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('abort')
}

/** Apply a single walker_notes row to an existing pickup entry */
function applyRow(entry, row) {
  const e = { ...(entry || { pickedUpAt: null, returnedAt: null, notWalking: false, walkerName: null }) }
  e.walkerName = row.walker_name ?? e.walkerName
  if (row.note_type === 'pickup')      { e.pickedUpAt = row.created_at; e.time = row.created_at }
  if (row.note_type === 'returned')    { e.returnedAt = row.created_at }
  if (row.note_type === 'not_walking') { e.notWalking = true }
  return e
}

/** Reverse a single walker_notes row from an existing pickup entry */
function removeRow(entry, row) {
  if (!entry) return entry
  const e = { ...entry }
  if (row.note_type === 'pickup')      { e.pickedUpAt = null; e.time = null }
  if (row.note_type === 'returned')    { e.returnedAt = null }
  if (row.note_type === 'not_walking') { e.notWalking = false }
  return e
}
export function usePickups(date) {
  const { user, profile } = useAuth()
  const { lastResyncAt } = useRealtimeHealth()
  const hasMountedRef = useRef(false)
  const [pickups, setPickups] = useState({}) // { dogId: { pickedUpAt, returnedAt, walkerName } }

  // Extract load function so we can call it on custom events
  const load = useCallback(async () => {
    if (!date) return
    const { data } = await supabase
      .from('walker_notes')
      .select('dog_id, note_type, created_at, walker_name')
      .eq('walk_date', date)
      .in('note_type', ['pickup', 'returned', 'not_walking'])

    if (data) {
      const map = {}
      for (const row of data) {
        if (!row.dog_id) continue
        map[row.dog_id] = applyRow(map[row.dog_id], row)
      }
      setPickups(map)
    }
  }, [date])

  // Initial load
  useEffect(() => {
    load()
  }, [load])

  // Audit 2026-05-13 HIGH #2: backfill on realtime resync. useChannelHealth
  // bumps lastResyncAt after visibilitychange / pageshow / focus / active
  // probe rebuilds the socket. Re-running load() backfills any
  // postgres_changes events that fired while the socket was dead. Skip the
  // initial render — the load-on-mount effect above already covered it.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    load()
  }, [lastResyncAt, load])

  // Custom event listener to keep multiple hook instances in sync across components
  useEffect(() => {
    const handleSync = (e) => {
      if (e.detail?.date === date && e.detail?.updater) {
        setPickups(prev => e.detail.updater(prev))
      } else if (e.detail === date) {
        load()
      }
    }
    window.addEventListener('pickups:sync', handleSync)
    return () => window.removeEventListener('pickups:sync', handleSync)
  }, [date, load])

  const notifySync = (updater) => {
    if (updater) window.dispatchEvent(new CustomEvent('pickups:sync', { detail: { date, updater } }))
    else window.dispatchEvent(new CustomEvent('pickups:sync', { detail: date }))
  }

  // ── Realtime subscription ──────────────────────────────────────
  // Shared channel: hook is mounted in GroupOrganizer + DogDrawer sub-components
  // concurrently; sharing prevents duplicate walker_notes subscriptions.
  useEffect(() => {
    if (!date) return

    return subscribeShared(
      {
        name: `pickups-${date}`,
        config: {
          event: '*',
          schema: 'public',
          table: 'walker_notes',
          filter: `walk_date=eq.${date}`,
        },
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old
          if (!oldRow?.dog_id) return
          setPickups(prev => ({ ...prev, [oldRow.dog_id]: removeRow(prev[oldRow.dog_id], oldRow) }))
          return
        }

        const row = payload.new
        if (!row?.dog_id) return
        setPickups(prev => ({ ...prev, [row.dog_id]: applyRow(prev[row.dog_id], row) }))
      }
    )
  }, [date])

  // ── Mark picked up ─────────────────────────────────────────────
  const markPickup = useCallback(async (dogId, dogName) => {
    if (!user || !date || !dogId) return
    // Audit 2026-05-13 Finding #6: pre-write guard against stale local state.
    if (pickups[dogId]?.pickedUpAt) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

    const now = new Date().toISOString()
    const rollback = () => setPickups(prev => {
      const next = { ...prev }
      if (next[dogId]) { next[dogId] = { ...next[dogId], pickedUpAt: null, time: null } }
      return next
    })

    setPickups(prev => ({
      ...prev,
      [dogId]: { ...(prev[dogId] || {}), pickedUpAt: now, time: now, walkerName: profile?.full_name || 'Walker' }
    }))

    const row = {
      dog_id: dogId,
      dog_name: dogName || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: 'pickup',
      walk_date: date,
    }

    const { error } = await supabase.from('walker_notes').insert(row)

    if (error) {
      // Audit 2026-05-13 Finding #5: 23505 (another walker beat us). Roll back
      // optimistic state so the realtime echo of the winning walker's row paints
      // their name; without rollback we keep our own name on a row we don't own.
      if (error.code === '23505') {
        rollback()
        return
      }
      // Audit 2026-05-13 Finding #1: transport-level failure → queue + keep
      // optimistic. Replay uses plain insert; the partial unique index
      // idx_walker_notes_one_state_per_dog_day (dog_id, walk_date, note_type)
      // guarantees no duplicate row if realtime arrival put one in before
      // replay (PG returns 23505, supabase-js does not throw). PostgREST's
      // on_conflict does not supply a WHERE predicate so it cannot infer the
      // partial index for upsert — insert is the correct primitive here.
      // Real DB errors fall through to rollback + toast.
      if (isTransportFailure(error)) {
        try {
          enqueueOfflineAction({
            type: 'insert',
            table: 'walker_notes',
            data: row,
          })
          toast('Queued — will sync when online')
          return
        } catch (queueErr) {
          console.warn('[pickups] enqueue failed', queueErr)
          // Fall through to rollback + toast.error.
        }
      }
      toast.error('Failed to save pickup')
      rollback()
    } else {
      notifySync(prev => ({
        ...prev,
        [dogId]: { ...(prev[dogId] || {}), pickedUpAt: now, time: now, walkerName: profile?.full_name || 'Walker' }
      }))
    }
  }, [user, profile, date, pickups])

  // ── Mark returned home ─────────────────────────────────────────
  const markReturned = useCallback(async (dogId, dogName) => {
    if (!user || !date || !dogId) return
    // Audit 2026-05-13 Finding #6: pre-write guard against stale local state.
    if (pickups[dogId]?.returnedAt) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

    const now = new Date().toISOString()
    const rollback = () => setPickups(prev => {
      const next = { ...prev }
      if (next[dogId]) { next[dogId] = { ...next[dogId], returnedAt: null } }
      return next
    })

    setPickups(prev => ({
      ...prev,
      [dogId]: { ...(prev[dogId] || {}), returnedAt: now }
    }))

    const row = {
      dog_id: dogId,
      dog_name: dogName || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: 'returned',
      walk_date: date,
    }

    const { error } = await supabase.from('walker_notes').insert(row)

    if (error) {
      // Audit 2026-05-13 Finding #5: 23505 → roll back so realtime echo wins.
      if (error.code === '23505') {
        rollback()
        return
      }
      // Audit 2026-05-13 Finding #1: transport-level → queue + keep optimistic.
      if (isTransportFailure(error)) {
        try {
          enqueueOfflineAction({
            type: 'insert',
            table: 'walker_notes',
            data: row,
          })
          toast('Queued — will sync when online')
          return
        } catch (queueErr) {
          console.warn('[pickups] enqueue failed', queueErr)
        }
      }
      toast.error('Failed to save return')
      rollback()
    } else {
      notifySync(prev => ({
        ...prev,
        [dogId]: { ...(prev[dogId] || {}), returnedAt: now }
      }))
    }
  }, [user, profile, date, pickups])

  // ── Undo pickup ──────────────────────────────────────────────────
  const undoPickup = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return false
    // Audit 2026-05-13 Finding #6: pre-write guard — nothing to undo.
    if (!pickups[dogId]?.pickedUpAt) return false
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return false; throw e }

    // Delete pickup AND any returned row — a return without a pickup is invalid state
    const { error } = await supabase.from('walker_notes').delete()
      .eq('dog_id', dogId)
      .eq('walk_date', date)
      .in('note_type', ['pickup', 'returned'])

    if (error) {
      // Audit 2026-05-13 Finding #1: transport-level → queue the delete.
      // Replay uses the same dog_id/walk_date/note_type filters; idempotent.
      if (isTransportFailure(error)) {
        try {
          enqueueOfflineAction({
            type: 'delete',
            table: 'walker_notes',
            filters: { dog_id: dogId, walk_date: date, note_type: ['pickup', 'returned'] },
          })
          setPickups(prev => {
            const next = { ...prev }
            if (next[dogId]) { next[dogId] = { ...next[dogId], pickedUpAt: null, time: null, returnedAt: null } }
            return next
          })
          toast('Queued — will sync when online')
          return true
        } catch (queueErr) {
          console.warn('[pickups] enqueue failed', queueErr)
        }
      }
      toast.error('Failed to undo pickup')
      return false
    } else {
      setPickups(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], pickedUpAt: null, time: null, returnedAt: null } }
        return next
      })
      toast('Pickup undone')
      notifySync(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], pickedUpAt: null, time: null, returnedAt: null } }
        return next
      })
      return true
    }
  }, [user, date, pickups])

  // ── Undo return only (keep picked-up state) ────────────────────
  const undoReturned = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return false
    // Audit 2026-05-13 Finding #6: pre-write guard — nothing to undo.
    if (!pickups[dogId]?.returnedAt) return false
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return false; throw e }

    const { error } = await supabase.from('walker_notes').delete()
      .eq('dog_id', dogId).eq('walk_date', date).eq('note_type', 'returned')

    if (error) {
      // Audit 2026-05-13 Finding #1: transport-level → queue the delete.
      if (isTransportFailure(error)) {
        try {
          enqueueOfflineAction({
            type: 'delete',
            table: 'walker_notes',
            filters: { dog_id: dogId, walk_date: date, note_type: 'returned' },
          })
          setPickups(prev => ({
            ...prev,
            [dogId]: { ...(prev[dogId] || {}), returnedAt: null }
          }))
          toast('Queued — will sync when online')
          return true
        } catch (queueErr) {
          console.warn('[pickups] enqueue failed', queueErr)
        }
      }
      toast.error('Failed to undo return')
      return false
    } else {
      setPickups(prev => ({
        ...prev,
        [dogId]: { ...(prev[dogId] || {}), returnedAt: null }
      }))
      toast('Return undone')
      notifySync(prev => ({
        ...prev,
        [dogId]: { ...(prev[dogId] || {}), returnedAt: null }
      }))
      return true
    }
  }, [user, date, pickups])

  // ── Update a timestamp (for profile drawer edit) ───────────────
  const updateTimestamp = useCallback(async (dogId, noteType, newTimeISO) => {
    if (!user || !date || !dogId) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

    // Optimistic update
    setPickups(prev => {
      const entry = { ...(prev[dogId] || {}) }
      if (noteType === 'pickup') { entry.pickedUpAt = newTimeISO; entry.time = newTimeISO }
      if (noteType === 'returned') { entry.returnedAt = newTimeISO }
      return { ...prev, [dogId]: entry }
    })

    // Delete old row then re-insert with new timestamp
    await supabase.from('walker_notes').delete()
      .eq('dog_id', dogId).eq('walk_date', date).eq('note_type', noteType)

    const { error } = await supabase.from('walker_notes').insert({
      dog_id: dogId,
      dog_name: 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: noteType,
      walk_date: date,
      created_at: newTimeISO,
    })

    if (error) {
      // Unique constraint — another walker's row still exists (RLS blocked our delete)
      if (error.code === '23505') return
      toast.error('Failed to update time')
    } else {
      toast.success('Time updated')
      notifySync()
    }
  }, [user, profile, date])

  // ── Mark not walking ────────────────────────────────────────────
  const markNotWalking = useCallback(async (dogId, dogName, groupNum) => {
    if (!user || !date || !dogId) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

    const rollback = () => setPickups(prev => {
      const next = { ...prev }
      if (next[dogId]) { next[dogId] = { ...next[dogId], notWalking: false } }
      return next
    })

    setPickups(prev => ({
      ...prev,
      [dogId]: { ...(prev[dogId] || {}), notWalking: true, walkerName: profile?.full_name || 'Walker' }
    }))

    const row = {
      dog_id: dogId,
      dog_name: dogName || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: 'not_walking',
      walk_date: date,
      message: 'Not walking today',
      group_num: groupNum || null,
    }

    const { error } = await supabase.from('walker_notes').insert(row)

    if (error) {
      // Audit 2026-05-13 Finding #5: 23505 → roll back so realtime echo wins.
      if (error.code === '23505') {
        rollback()
        return
      }
      // Audit 2026-05-13 Finding #1: transport-level → queue + keep optimistic.
      if (isTransportFailure(error)) {
        try {
          enqueueOfflineAction({
            type: 'insert',
            table: 'walker_notes',
            data: row,
          })
          toast('Queued — will sync when online')
          return
        } catch (queueErr) {
          console.warn('[pickups] enqueue failed', queueErr)
        }
      }
      toast.error('Failed to save')
      rollback()
    } else {
      notifySync()
    }
  }, [user, profile, date])

  // ── Undo not walking ──────────────────────────────────────────
  const undoNotWalking = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return false
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return false; throw e }

    const { error } = await supabase.from('walker_notes').delete()
      .eq('dog_id', dogId).eq('walk_date', date).eq('note_type', 'not_walking')

    if (error) {
      toast.error('Failed to undo')
      return false
    } else {
      setPickups(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], notWalking: false } }
        return next
      })
      toast('Not walking undone')
      notifySync(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], notWalking: false } }
        return next
      })
      return true
    }
  }, [user, date])

  return { pickups, markPickup, markReturned, undoPickup, undoReturned, updateTimestamp, markNotWalking, undoNotWalking }
}
