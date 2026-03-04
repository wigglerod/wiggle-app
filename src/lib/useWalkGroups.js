import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Hook for managing walk groups with Supabase persistence + realtime sync.
 *
 * State shape:
 *   groups = { unassigned: [eventId, ...], 1: [...], 2: [...], 3: [...] }
 */
export function useWalkGroups(events, date, sector) {
  const { user } = useAuth()
  const [groups, setGroups] = useState({ unassigned: [], 1: [], 2: [], 3: [] })
  const [loaded, setLoaded] = useState(false)

  // All event IDs for this sector
  const allEventIds = events.map((ev) => ev._id?.toString?.() || String(ev._id))

  // Load saved groups from Supabase
  useEffect(() => {
    if (!date || !sector || allEventIds.length === 0) return

    async function load() {
      const { data } = await supabase
        .from('walk_groups')
        .select('*')
        .eq('walk_date', date)
        .eq('sector', sector)

      const saved = { 1: [], 2: [], 3: [] }
      const assignedSet = new Set()

      if (data) {
        for (const row of data) {
          const ids = (row.dog_ids || []).filter((id) => allEventIds.includes(id))
          saved[row.group_num] = ids
          ids.forEach((id) => assignedSet.add(id))
        }
      }

      const unassigned = allEventIds.filter((id) => !assignedSet.has(id))
      setGroups({ unassigned, ...saved })
      setLoaded(true)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, sector, allEventIds.length])

  // Realtime subscription
  useEffect(() => {
    if (!date || !sector) return

    const channel = supabase
      .channel(`walk-groups-${date}-${sector}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'walk_groups',
          filter: `walk_date=eq.${date}`,
        },
        (payload) => {
          const row = payload.new
          if (!row || row.sector !== sector) return

          setGroups((prev) => {
            const ids = (row.dog_ids || []).filter((id) => allEventIds.includes(id))
            const next = { ...prev, [row.group_num]: ids }

            // Rebuild unassigned
            const assignedSet = new Set()
            for (let g = 1; g <= 3; g++) {
              ;(next[g] || []).forEach((id) => assignedSet.add(id))
            }
            next.unassigned = allEventIds.filter((id) => !assignedSet.has(id))
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, sector, allEventIds.length])

  // Persist a group to Supabase
  const saveGroup = useCallback(
    async (groupNum, dogIds) => {
      if (!date || !sector || !user) return

      await supabase.from('walk_groups').upsert(
        {
          walk_date: date,
          group_num: groupNum,
          sector,
          dog_ids: dogIds,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'walk_date,group_num,sector' }
      )
    },
    [date, sector, user]
  )

  // Move an event from one group to another
  const moveEvent = useCallback(
    (eventId, fromGroup, toGroup) => {
      if (fromGroup === toGroup) return

      const id = String(eventId)

      setGroups((prev) => {
        const next = { ...prev }
        // Remove from source
        next[fromGroup] = (prev[fromGroup] || []).filter((eid) => eid !== id)
        // Add to destination
        next[toGroup] = [...(prev[toGroup] || []), id]
        return next
      })

      // Persist changed groups (not 'unassigned' — that's derived)
      if (fromGroup !== 'unassigned') {
        setGroups((prev) => {
          saveGroup(fromGroup, prev[fromGroup])
          return prev
        })
      }
      if (toGroup !== 'unassigned') {
        setGroups((prev) => {
          saveGroup(toGroup, prev[toGroup])
          return prev
        })
      }
    },
    [saveGroup]
  )

  return { groups, moveEvent, loaded }
}
