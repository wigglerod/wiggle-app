import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { assertFreshOrThrow, StaleBundleError } from './freshBundle'
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
  const { user, profile } = useAuth()
  const [groups, setGroups] = useState({ unassigned: [] })
  const [groupNums, setGroupNums] = useState([1, 2, 3])
  const [groupNames, setGroupNames] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [groupLocks, setGroupLocks] = useState({}) // { groupNum: { locked: bool, locked_by: uuid, locked_by_name: string } }
  const [walkerAssignments, setWalkerAssignments] = useState({}) // { groupNum: [walkerId, ...] }
  const [groupLinks, setGroupLinks] = useState([]) // [{ id, group_a_key, group_b_key }]

  // Refs to avoid stale closures in callbacks
  const groupsRef = useRef(groups)
  const groupNamesRef = useRef(groupNames)
  const groupNumsRef = useRef(groupNums)
  const walkerAssignmentsRef = useRef(walkerAssignments)
  useEffect(() => { groupsRef.current = groups }, [groups])
  useEffect(() => { groupNamesRef.current = groupNames }, [groupNames])
  useEffect(() => { groupNumsRef.current = groupNums }, [groupNums])
  useEffect(() => { walkerAssignmentsRef.current = walkerAssignments }, [walkerAssignments])

  // Use dog_name as the canonical ID (matches walk_groups.dog_ids column).
  // Events without a resolved dog are excluded — no mixed-shape fallback.
  const allEventIds = events
    .map((ev) => ev.dog?.dog_name || null)
    .filter((id) => id !== null)

  // Load saved groups from Supabase
  useEffect(() => {
    if (!date || !sector || allEventIds.length === 0) return

    async function load() {
      // Build query — fetch ALL groups for today. Every walker needs to see
      // all groups (including ones locked by others) so the organizer renders correctly.
      const query = supabase
        .from('walk_groups')
        .select('*')
        .eq('walk_date', date)
        .eq('sector', sector)

      const { data, error: loadError } = await query

      if (loadError) {
        toast.error('Failed to load walk groups')
      }

      const saved = {}
      const names = {}
      const walkers = {}
      const locks = {}
      const assignedSet = new Set()
      const nums = new Set([1, 2, 3])

      if (data) {
        for (const row of data) {
          // Filter to valid event IDs and deduplicate (dog can only be in ONE group)
          const ids = [...new Set(row.dog_ids || [])].filter((id) => allEventIds.includes(id) && !assignedSet.has(id))
          saved[row.group_num] = ids
          ids.forEach((id) => assignedSet.add(id))
          if (row.group_name) names[row.group_num] = row.group_name
          const wIds = row.walker_ids?.length ? row.walker_ids : (row.walker_id ? [row.walker_id] : [])
          if (wIds.length > 0) walkers[row.group_num] = wIds
          if (row.locked) locks[row.group_num] = { locked: true, locked_by: row.locked_by || null, locked_by_name: row.locked_by_name || null }
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
      setWalkerAssignments(walkers)
      setGroupLocks(locks)
      setGroups({ unassigned, ...saved })
      setLoaded(true)

      // Load group links
      const { data: links } = await supabase
        .from('group_links')
        .select('*')
        .eq('walk_date', date)
        .eq('sector', sector)
      setGroupLinks(links || [])
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

          // Sync per-group lock state from realtime
          if (row.locked !== undefined) {
            setGroupLocks((prev) => {
              if (row.locked) {
                return { ...prev, [row.group_num]: { locked: true, locked_by: row.locked_by || null, locked_by_name: row.locked_by_name || null } }
              }
              const next = { ...prev }
              delete next[row.group_num]
              return next
            })
          }

          // Sync walker assignment from realtime (use walker_ids array, fall back to walker_id)
          setWalkerAssignments((prev) => {
            const wIds = row.walker_ids?.length ? row.walker_ids : (row.walker_id ? [row.walker_id] : [])
            if (wIds.length > 0) return { ...prev, [row.group_num]: wIds }
            const next = { ...prev }
            delete next[row.group_num]
            return next
          })

          setGroups((prev) => {
            const ids = [...new Set(row.dog_ids || [])].filter((id) => allEventIds.includes(id))
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
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

      const wIds = walkerAssignmentsRef.current[groupNum] || []
      const { error } = await supabase.from('walk_groups').upsert(
        {
          walk_date: date,
          group_num: groupNum,
          sector,
          dog_ids: dogIds,
          group_name: groupNamesRef.current[groupNum] ?? null,
          walker_id: wIds[0] ?? null,
          walker_ids: wIds.length > 0 ? wIds : null,
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
    },
    [saveGroup]
  )

  // Add a new group beyond the current max
  const addGroup = useCallback((name, walkerIds) => {
    const nextNum = Math.max(...groupNumsRef.current) + 1
    setGroupNums((prev) => [...prev, nextNum])
    setGroups((prev) => ({ ...prev, [nextNum]: [] }))
    if (name) setGroupNames((prev) => ({ ...prev, [nextNum]: name }))
    if (walkerIds?.length) setWalkerAssignments((prev) => ({ ...prev, [nextNum]: walkerIds }))

    // Persist the group row with optional name + walkers
    if (date && sector && user) {
      ;(async () => {
        try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
        const { error } = await supabase.from('walk_groups').upsert(
          {
            walk_date: date,
            group_num: nextNum,
            sector,
            dog_ids: [],
            group_name: name || null,
            walker_id: walkerIds?.[0] ?? null,
            walker_ids: walkerIds?.length ? walkerIds : null,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'walk_date,group_num,sector' }
        )
        if (error) toast.error('Failed to add group')
      })()
    }

    return nextNum
  }, [date, sector, user])

  // Rename a group and persist
  const renameGroup = useCallback(
    async (groupNum, name) => {
      setGroupNames((prev) => ({ ...prev, [groupNum]: name }))

      if (!date || !sector || !user) return
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

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

  // Reorder dogs within a group (preserves pickup order)
  const reorderGroup = useCallback(
    (groupNum, newOrderedIds) => {
      setGroups((prev) => ({ ...prev, [groupNum]: newOrderedIds }))
      saveGroup(groupNum, newOrderedIds)
    },
    [saveGroup]
  )

  // Lock a single group
  const lockGroup = useCallback(async (groupNum) => {
    if (!date || !sector || !user) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    const lockerName = profile?.full_name?.split(' ')[0] || 'Walker'
    setGroupLocks((prev) => ({ ...prev, [groupNum]: { locked: true, locked_by: user.id, locked_by_name: lockerName } }))

    const { error } = await supabase.from('walk_groups')
      .update({ locked: true, locked_by: user.id, locked_by_name: lockerName })
      .eq('walk_date', date)
      .eq('group_num', groupNum)
      .eq('sector', sector)

    if (error) {
      console.error('Lock failed:', error)
      toast.error('Failed to lock group')
      setGroupLocks((prev) => { const next = { ...prev }; delete next[groupNum]; return next })
    }
  }, [date, sector, user, profile])

  // Unlock a single group
  const unlockGroup = useCallback(async (groupNum) => {
    if (!date || !sector || !user) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setGroupLocks((prev) => { const next = { ...prev }; delete next[groupNum]; return next })

    const { error } = await supabase.from('walk_groups')
      .update({ locked: false, locked_by: null, locked_by_name: null })
      .eq('walk_date', date)
      .eq('group_num', groupNum)
      .eq('sector', sector)

    if (error) {
      console.error('Unlock failed:', error)
      toast.error('Failed to unlock group')
    }
  }, [date, sector, user])

  // Add a walker to a group (supports co-walkers)
  const addWalker = useCallback(
    async (groupNum, walkerId) => {
      if (!walkerId) return
      setWalkerAssignments((prev) => {
        const current = prev[groupNum] || []
        if (current.includes(walkerId)) return prev
        return { ...prev, [groupNum]: [...current, walkerId] }
      })
      await _persistWalkerIds(groupNum, [...(walkerAssignmentsRef.current[groupNum] || []), walkerId])
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, sector, user]
  )

  // Remove a walker from a group
  const removeWalker = useCallback(
    async (groupNum, walkerId) => {
      setWalkerAssignments((prev) => {
        const current = (prev[groupNum] || []).filter(id => id !== walkerId)
        if (current.length === 0) {
          const next = { ...prev }
          delete next[groupNum]
          return next
        }
        return { ...prev, [groupNum]: current }
      })
      const updated = (walkerAssignmentsRef.current[groupNum] || []).filter(id => id !== walkerId)
      await _persistWalkerIds(groupNum, updated)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, sector, user]
  )

  // Set exact walker list (replaces all) — used for slot-based picker
  const setWalkers = useCallback(
    async (groupNum, walkerIds) => {
      setWalkerAssignments((prev) => {
        if (walkerIds.length === 0) {
          const next = { ...prev }; delete next[groupNum]; return next
        }
        return { ...prev, [groupNum]: walkerIds }
      })
      await _persistWalkerIds(groupNum, walkerIds)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, sector, user]
  )

  // Internal helper: persist walker_ids to Supabase
  async function _persistWalkerIds(groupNum, walkerIds) {
    if (!date || !sector || !user) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    const { error } = await supabase.from('walk_groups').upsert(
      {
        walk_date: date,
        group_num: groupNum,
        sector,
        dog_ids: groupsRef.current[groupNum] || [],
        group_name: groupNamesRef.current[groupNum] ?? null,
        walker_id: walkerIds[0] ?? null,
        walker_ids: walkerIds.length > 0 ? walkerIds : null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'walk_date,group_num,sector' }
    )
    if (error) toast.error('Failed to update walkers')
    else toast.success('Updated')
  }

  // Link two groups (syncPosition: null=side-by-side, number=stagger at that dog index in group A)
  const linkGroups = useCallback(
    async (groupNumA, groupNumB, syncPosition) => {
      if (!date || !sector) return
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
      const keyA = `${date}_${sector}_${groupNumA}`
      const keyB = `${date}_${sector}_${groupNumB}`
      const { data, error } = await supabase.from('group_links').insert({
        group_a_key: keyA,
        group_b_key: keyB,
        walk_date: date,
        sector,
        sync_position: syncPosition ?? null,
      }).select()
      if (!error && data) setGroupLinks(prev => [...prev, data[0]])
      else if (error) toast.error('Failed to link groups')
    },
    [date, sector]
  )

  // Unlink groups
  const unlinkGroups = useCallback(
    async (linkId) => {
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
      await supabase.from('group_links').delete().eq('id', linkId)
      setGroupLinks(prev => prev.filter(l => l.id !== linkId))
    },
    []
  )

  return {
    groups, groupNums, groupNames, walkerAssignments, groupLinks, groupLocks,
    moveEvent, addGroup, renameGroup, reorderGroup,
    addWalker, removeWalker, setWalkers, linkGroups, unlinkGroups,
    loaded, lastSaved, lockGroup, unlockGroup,
  }
}
