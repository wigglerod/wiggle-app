import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Hook for managing dog pickup + return timestamps during walking mode.
 * Stores events as walker_notes rows:
 *   note_type = 'pickup'   → dog was picked up
 *   note_type = 'returned' → dog was returned home
 *
 * State shape:
 *   pickups = {
 *     [dogId]: { pickedUpAt: ISOString, returnedAt: ISOString|null, walkerName: string }
 *   }
 */
export function usePickups(date) {
  const { user, profile } = useAuth()
  const [pickups, setPickups] = useState({}) // { dogId: { pickedUpAt, returnedAt, walkerName } }

  // ── Load existing pickups + returns for today ──────────────────
  useEffect(() => {
    if (!date) return
    async function load() {
      const { data } = await supabase
        .from('walker_notes')
        .select('dog_id, note_type, created_at, walker_name')
        .eq('walk_date', date)
        .in('note_type', ['pickup', 'returned'])

      if (data) {
        const map = {}
        for (const row of data) {
          if (!row.dog_id) continue
          if (!map[row.dog_id]) map[row.dog_id] = { pickedUpAt: null, returnedAt: null, walkerName: row.walker_name }
          if (row.note_type === 'pickup') map[row.dog_id].pickedUpAt = row.created_at
          if (row.note_type === 'returned') map[row.dog_id].returnedAt = row.created_at
        }
        // Legacy compat: expose .time on the root for any code still reading pickups[id].time
        for (const id of Object.keys(map)) {
          map[id].time = map[id].pickedUpAt
        }
        setPickups(map)
      }
    }
    load()
  }, [date])

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
            // Re-fetch on delete to stay in sync
            supabase
              .from('walker_notes')
              .select('dog_id, note_type, created_at, walker_name')
              .eq('walk_date', date)
              .in('note_type', ['pickup', 'returned'])
              .then(({ data }) => {
                if (data) {
                  const map = {}
                  for (const row of data) {
                    if (!row.dog_id) continue
                    if (!map[row.dog_id]) map[row.dog_id] = { pickedUpAt: null, returnedAt: null, walkerName: row.walker_name }
                    if (row.note_type === 'pickup') map[row.dog_id].pickedUpAt = row.created_at
                    if (row.note_type === 'returned') map[row.dog_id].returnedAt = row.created_at
                  }
                  for (const id of Object.keys(map)) map[id].time = map[id].pickedUpAt
                  setPickups(map)
                }
              })
            return
          }

          const row = payload.new
          if (!row?.dog_id) return

          if (row.note_type === 'pickup') {
            setPickups(prev => ({
              ...prev,
              [row.dog_id]: {
                ...(prev[row.dog_id] || {}),
                pickedUpAt: row.created_at,
                time: row.created_at,
                walkerName: row.walker_name,
              }
            }))
          } else if (row.note_type === 'returned') {
            setPickups(prev => ({
              ...prev,
              [row.dog_id]: {
                ...(prev[row.dog_id] || {}),
                returnedAt: row.created_at,
                walkerName: row.walker_name,
              }
            }))
          }
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
    }
  }, [user, profile, date])

  // ── Undo pickup (also removes returned row) ────────────────────
  const undoPickup = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return

    const previous = pickups[dogId]
    setPickups(prev => { const next = { ...prev }; delete next[dogId]; return next })

    // Delete both pickup and returned rows
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('walker_notes').delete()
        .eq('dog_id', dogId).eq('walk_date', date).eq('note_type', 'pickup'),
      supabase.from('walker_notes').delete()
        .eq('dog_id', dogId).eq('walk_date', date).eq('note_type', 'returned'),
    ])

    if (e1 || e2) {
      toast.error('Failed to undo pickup')
      if (previous) setPickups(prev => ({ ...prev, [dogId]: previous }))
    } else {
      toast('Pickup undone')
    }
  }, [user, date, pickups])

  // ── Undo return only (keep picked-up state) ────────────────────
  const undoReturned = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return

    const previous = pickups[dogId]
    setPickups(prev => ({
      ...prev,
      [dogId]: { ...(prev[dogId] || {}), returnedAt: null }
    }))

    const { error } = await supabase.from('walker_notes').delete()
      .eq('dog_id', dogId).eq('walk_date', date).eq('note_type', 'returned')

    if (error) {
      toast.error('Failed to undo return')
      if (previous) setPickups(prev => ({ ...prev, [dogId]: previous }))
    } else {
      toast('Return undone')
    }
  }, [user, date, pickups])

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

    if (error) toast.error('Failed to update time')
    else toast.success('Time updated')
  }, [user, profile, date])

  return { pickups, markPickup, markReturned, undoPickup, undoReturned, updateTimestamp }
}
