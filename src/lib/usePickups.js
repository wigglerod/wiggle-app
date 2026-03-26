import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Hook for managing dog pickup timestamps during walking mode.
 * Stores pickups as walker_notes with note_type='pickup'.
 * Provides realtime sync so all walkers see pickups.
 */
export function usePickups(date) {
  const { user, profile } = useAuth()
  const [pickups, setPickups] = useState({}) // { dogId: { time: ISOString, walkerName } }

  // Load existing pickups for today
  useEffect(() => {
    if (!date) return

    async function load() {
      const { data } = await supabase
        .from('walker_notes')
        .select('dog_id, created_at, walker_name')
        .eq('walk_date', date)
        .eq('note_type', 'pickup')

      if (data) {
        const map = {}
        for (const row of data) {
          if (row.dog_id) map[row.dog_id] = { time: row.created_at, walkerName: row.walker_name }
        }
        setPickups(map)
      }
    }
    load()
  }, [date])

  // Realtime subscription for pickup changes (INSERT + DELETE)
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
            // Re-fetch all pickups to stay in sync (DELETE payload may lack full row data)
            supabase
              .from('walker_notes')
              .select('dog_id, created_at, walker_name')
              .eq('walk_date', date)
              .eq('note_type', 'pickup')
              .then(({ data }) => {
                if (data) {
                  const map = {}
                  for (const row of data) {
                    if (row.dog_id) map[row.dog_id] = { time: row.created_at, walkerName: row.walker_name }
                  }
                  setPickups(map)
                }
              })
            return
          }
          const row = payload.new
          if (row?.note_type === 'pickup' && row.dog_id) {
            setPickups(prev => ({
              ...prev,
              [row.dog_id]: { time: row.created_at, walkerName: row.walker_name }
            }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [date])

  const markPickup = useCallback(async (dogId, dogName) => {
    if (!user || !date || !dogId) return

    // Optimistic update
    const now = new Date().toISOString()
    setPickups(prev => ({ ...prev, [dogId]: { time: now, walkerName: profile?.full_name || 'Walker' } }))

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
        delete next[dogId]
        return next
      })
    }
  }, [user, profile, date])

  const undoPickup = useCallback(async (dogId) => {
    if (!user || !date || !dogId) return

    // Optimistic: remove from local state
    const previous = pickups[dogId]
    setPickups(prev => {
      const next = { ...prev }
      delete next[dogId]
      return next
    })

    const { error } = await supabase
      .from('walker_notes')
      .delete()
      .eq('dog_id', dogId)
      .eq('walk_date', date)
      .eq('note_type', 'pickup')

    if (error) {
      toast.error('Failed to undo pickup')
      // Restore optimistic removal
      if (previous) {
        setPickups(prev => ({ ...prev, [dogId]: previous }))
      }
    } else {
      toast('Pickup undone')
    }
  }, [user, date, pickups])

  return { pickups, markPickup, undoPickup }
}
