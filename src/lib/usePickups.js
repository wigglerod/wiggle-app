import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

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
  useEffect(() => {
    if (!date) return

    const channel = supabase
      .channel(`pickups-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'walker_notes',
          filter: `walk_date=eq.${date}`,
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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [date])

  // ── Mark picked up ─────────────────────────────────────────────
  const markPickup = useCallback(async (dogId, dogName) => {
    if (!user || !date || !dogId) return

    const now = new Date().toISOString()
    setPickups(prev => ({
      ...prev,
      [dogId]: { ...(prev[dogId] || {}), pickedUpAt: now, time: now, walkerName: profile?.full_name || 'Walker' }
    }))

    const { error } = await supabase.from('walker_notes').insert({
      dog_id: dogId,
      dog_name: dogName || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: 'pickup',
      walk_date: date,
    })

    if (error) {
      toast.error('Failed to save pickup')
      setPickups(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], pickedUpAt: null, time: null } }
        return next
      })
    } else {
      notifySync(prev => ({
        ...prev,
        [dogId]: { ...(prev[dogId] || {}), pickedUpAt: now, time: now, walkerName: profile?.full_name || 'Walker' }
      }))
    }
  }, [user, profile, date])

  // ── Mark returned home ─────────────────────────────────────────
  const markReturned = useCallback(async (dogId, dogName) => {
    if (!user || !date || !dogId) return

    const now = new Date().toISOString()
    setPickups(prev => ({
      ...prev,
      [dogId]: { ...(prev[dogId] || {}), returnedAt: now }
    }))

    const { error } = await supabase.from('walker_notes').insert({
      dog_id: dogId,
      dog_name: dogName || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: 'returned',
      walk_date: date,
    })

    if (error) {
      toast.error('Failed to save return')
      setPickups(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], returnedAt: null } }
        return next
      })
    } else {
      notifySync(prev => ({
        ...prev,
        [dogId]: { ...(prev[dogId] || {}), returnedAt: now }
      }))
    }
  }, [user, profile, date])

  // ── Undo pickup ──────────────────────────────────────────────────
  const undoPickup = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return false

    const { error } = await supabase.from('walker_notes').delete()
      .eq('dog_id', dogId)
      .eq('note_type', 'pickup')
      .eq('walk_date', date)

    if (error) {
      toast.error('Failed to undo pickup')
      return false
    } else {
      setPickups(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], pickedUpAt: null, time: null } }
        return next
      })
      toast('Pickup undone')
      notifySync(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], pickedUpAt: null, time: null } }
        return next
      })
      return true
    }
  }, [user, date])

  // ── Undo return only (keep picked-up state) ────────────────────
  const undoReturned = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return false

    const { error } = await supabase.from('walker_notes').delete()
      .eq('dog_id', dogId).eq('walk_date', date).eq('note_type', 'returned')

    if (error) {
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
  }, [user, date])

  // ── Update a timestamp (for profile drawer edit) ───────────────
  const updateTimestamp = useCallback(async (dogId, noteType, newTimeISO) => {
    if (!user || !date || !dogId) return

    // Optimistic update
    setPickups(prev => {
      const entry = { ...(prev[dogId] || {}) }
      if (noteType === 'pickup') { entry.pickedUpAt = newTimeISO; entry.time = newTimeISO }
      if (noteType === 'returned') { entry.returnedAt = newTimeISO }
      return { ...prev, [dogId]: entry }
    })

    // Note: walker_notes has no unique constraint on dog_id+note_type, so we update via delete+insert
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
      toast.error('Failed to update time')
    } else {
      toast.success('Time updated')
      notifySync()
    }
  }, [user, profile, date])

  // ── Mark not walking ────────────────────────────────────────────
  const markNotWalking = useCallback(async (dogId, dogName, groupNum) => {
    if (!user || !date || !dogId) return

    setPickups(prev => ({
      ...prev,
      [dogId]: { ...(prev[dogId] || {}), notWalking: true, walkerName: profile?.full_name || 'Walker' }
    }))

    const { error } = await supabase.from('walker_notes').insert({
      dog_id: dogId,
      dog_name: dogName || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: 'not_walking',
      walk_date: date,
      message: 'Not walking today',
      group_num: groupNum || null,
    })

    if (error) {
      toast.error('Failed to save')
      setPickups(prev => {
        const next = { ...prev }
        if (next[dogId]) { next[dogId] = { ...next[dogId], notWalking: false } }
        return next
      })
    } else {
      notifySync()
    }
  }, [user, profile, date])

  // ── Undo not walking ──────────────────────────────────────────
  const undoNotWalking = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return false

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
