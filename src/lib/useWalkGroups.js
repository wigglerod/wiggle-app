import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Hook for managing walk groups with Supabase persistence + realtime sync.
 *
 * State shape:
 *   groups    = { unassigned: [eventId, ...], 1: [...], 2: [...], ... }
 *   groupNums = [1, 2, 3, ...]   (ordered list of numbered group keys)
 *   groupNames = { 1: 'Morning Plateau', 2: 'Afternoon Park', ... }
 *
 * Required DB migration (run once in Supabase SQL editor):
 *   ALTER TABLE walk_groups ADD COLUMN IF NOT EXISTS group_name TEXT;
 */
export function useWalkGroups(events, date, sector) {
  const { user } = useAuth()
  const [groups, setGroups] = useState({ unassigned: [] })
  const [groupNums, setGroupNums] = useState([1, 2, 3])
  const [groupNames, setGroupNames] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  // Refs to avoid stale closures in callbacks
  const groupsRef = useRef(groups)
  const groupNamesRef = useRef(groupNames)
  const groupNumsRef = useRef(groupNums)
  useEffect(() => { groupsRef.current = groups }, [groups])
  useEffect(() => { groupNamesRef.current = groupNames }, [groupNames])
  useEffect(() => { groupNumsRef.current = groupNums }, [groupNums])

  const allEventIds = events.map((ev) => ev._id?.toString?.() || String(ev._id))

  // Load saved groups from Supabase
  useEffect(() => {
    if (!date || !sector || allEventIds.length === 0) return

    async function load() {
      const { data, error: loadError } = await supabase
        .from('walk_groups')
        .select('*')
        .eq('walk_date', date)
        .eq('sector', sector)

      if (loadError) {
        toast.error('Failed to load walk groups')
      }

      const saved = {}
      const names = {}
      const assignedSet = new Set()
      const nums = new Set([1, 2, 3])

      if (data) {
        for (const row of data) {
          // Filter to valid event IDs and deduplicate (dog can only be in ONE group)
          const ids = (row.dog_ids || []).filter((id) => allEventIds.includes(id) && !assignedSet.has(id))
          saved[row.group_num] = ids
          ids.forEach((id) => assignedSet.add(id))
          if (row.group_name) names[row.group_num] = row.group_name
          nums.add(row.group_num)
        }
      }

      // Ensure all group nums have an entry
      for (const n of nums) {
        if (!saved[n]) saved[n] = []
      }

      const sortedNums = Array.from(nums).sort((a, b) => a - b)
      const unassigned = allEventIds.filter((id) => !assignedSet.has(id))

      setGroupNums(sortedNums)
      setGroupNames(names)
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

          // Add group_num to our known set if it's new
          setGroupNums((prev) => {
            if (!prev.includes(row.group_num)) {
              return [...prev, row.group_num].sort((a, b) => a - b)
            }
            return prev
          })

          if (row.group_name) {
            setGroupNames((prev) => ({ ...prev, [row.group_num]: row.group_name }))
          }

          setGroups((prev) => {
            const ids = (row.dog_ids || []).filter((id) => allEventIds.includes(id))
            const next = { ...prev, [row.group_num]: ids }

            // Rebuild unassigned from all known group nums
            const assignedSet = new Set()
            for (const n of groupNumsRef.current) {
              ;(next[n] || []).forEach((id) => assignedSet.add(id))
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

  // Persist a group to Supabase (includes current name)
  const saveGroup = useCallback(
    async (groupNum, dogIds) => {
      if (!date || !sector || !user) return

      const { error } = await supabase.from('walk_groups').upsert(
        {
          walk_date: date,
          group_num: groupNum,
          sector,
          dog_ids: dogIds,
          group_name: groupNamesRef.current[groupNum] ?? null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'walk_date,group_num,sector' }
      )
      if (error) {
        toast.error('Failed to save group changes')
      } else {
        setLastSaved(new Date())
      }
    },
    [date, sector, user]
  )

  // Move an event from one group to another (removes from ALL groups first to prevent duplicates)
  const moveEvent = useCallback(
    (eventId, fromGroup, toGroup) => {
      if (fromGroup === toGroup) return

      const id = String(eventId)
      const prev = groupsRef.current
      const next = { ...prev }
      const affectedGroups = new Set()

      // Remove from ALL groups first to prevent duplicates
      for (const key of ['unassigned', ...groupNumsRef.current]) {
        const before = (prev[key] || []).length
        next[key] = (prev[key] || []).filter((eid) => eid !== id)
        if (next[key].length !== before && key !== 'unassigned') affectedGroups.add(key)
      }
      // Add to target
      next[toGroup] = [...(next[toGroup] || []), id]
      if (toGroup !== 'unassigned') affectedGroups.add(toGroup)

      setGroups(next)

      // Persist each affected group immediately
      for (const gNum of affectedGroups) {
        saveGroup(gNum, next[gNum])
      }

      toast.success('✓ Saved')
    },
    [saveGroup]
  )

  // Add a new group beyond the current max
  const addGroup = useCallback(() => {
    const nextNum = Math.max(...groupNumsRef.current) + 1
    setGroupNums((prev) => [...prev, nextNum])
    setGroups((prev) => ({ ...prev, [nextNum]: [] }))

    // Persist the empty group row so the name can be saved against it
    if (date && sector && user) {
      supabase.from('walk_groups').upsert(
        {
          walk_date: date,
          group_num: nextNum,
          sector,
          dog_ids: [],
          group_name: null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'walk_date,group_num,sector' }
      ).then(({ error }) => {
        if (error) toast.error('Failed to add group')
      })
    }
  }, [date, sector, user])

  // Rename a group and persist
  const renameGroup = useCallback(
    async (groupNum, name) => {
      setGroupNames((prev) => ({ ...prev, [groupNum]: name }))

      if (!date || !sector || !user) return

      // Upsert with current dog_ids from ref so we don't wipe them
      const { error } = await supabase.from('walk_groups').upsert(
        {
          walk_date: date,
          group_num: groupNum,
          sector,
          dog_ids: groupsRef.current[groupNum] || [],
          group_name: name,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'walk_date,group_num,sector' }
      )
      if (error) toast.error('Failed to rename group')
    },
    [date, sector, user]
  )

  return { groups, groupNums, groupNames, moveEvent, addGroup, renameGroup, loaded, lastSaved }
}
