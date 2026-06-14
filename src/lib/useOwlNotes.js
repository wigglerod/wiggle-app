import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { subscribeShared } from './sharedRealtimeChannel'
import { assertFreshOrThrow, StaleBundleError } from './freshBundle'
import { useAuth } from '../context/AuthContext'
import { useRealtimeHealth } from '../context/RealtimeHealthContext'

/**
 * Parse duration syntax from the end of note text.
 * Supports: (3 days), (2 weeks), (1 month), etc.
 */
function parseDuration(text) {
  const match = text.match(/\((\d+)\s*(day|days|week|weeks|month|months)\)\s*$/)
  if (!match) return { cleanText: text, expiresAt: null }

  const num = parseInt(match[1])
  const unit = match[2].toLowerCase()
  const cleanText = text.replace(/\s*\((\d+)\s*(day|days|week|weeks|month|months)\)\s*$/, '').trim()

  const now = new Date()
  if (unit.startsWith('day')) now.setDate(now.getDate() + num)
  else if (unit.startsWith('week')) now.setDate(now.getDate() + num * 7)
  else if (unit.startsWith('month')) now.setMonth(now.getMonth() + num)

  return { cleanText, expiresAt: now.toISOString() }
}

// Toronto date as YYYY-MM-DD (matches DB scheduled_date / ack_date).
function todayInToronto() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
}

// End-of-day instant for a YYYY-MM-DD date in America/Toronto, returned as ISO UTC.
// Default for owl-note expires_at when no duration tail is given.
function endOfDayInTorontoISO(dateStr) {
  // Use Intl to get Toronto's offset on this date (handles DST).
  const probe = new Date(`${dateStr}T17:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    timeZoneName: 'longOffset',
  }).formatToParts(probe)
  const offsetStr = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT-05:00'
  const offset = offsetStr.replace(/^GMT/, '') || '-05:00'
  return new Date(`${dateStr}T23:59:59.999${offset}`).toISOString()
}

/**
 * Hook for managing owl notes with Supabase persistence + realtime sync.
 *
 * Owl notes are short messages that can target a specific dog, a sector, or everyone.
 * Acknowledgement is per-walker via the owl_note_acks join table (Wheel 1 Bug 1).
 */
export function useOwlNotes(sector) {
  const { user, profile, permissions } = useAuth()
  const { lastResyncAt } = useRealtimeHealth()
  const hasMountedRef = useRef(false)
  const userSector = profile?.sector
  const userId = user?.id
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  // Set of note_ids the current walker has acked for today.
  // We track this in state so realtime updates re-render the filter.
  const [myAcks, setMyAcks] = useState(() => new Set())

  // Fetch non-expired notes + this walker's acks for today.
  // No DELETEs from this hook — walker path is SELECT-only (audit HIGH #7).
  const load = useCallback(async () => {
    setLoading(true)
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

    let query = supabase
      .from('owl_notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (!permissions?.canSeeAllSectors && userSector && userSector !== 'both') {
      query = query.or(`target_sector.eq.${userSector},and(target_sector.is.null,target_dog_id.is.null)`)
    }

    const { data, error } = await query

    if (error) {
      toast.error('Failed to load owl notes')
      setLoading(false)
      return
    }

    // Filter out any that might have expired between query and now.
    // Legacy rows with NULL expires_at: treat scheduled_date < today as stale
    // (defense in depth for pre-Wheel-1 data that escaped the EOD writer default).
    const now = new Date()
    const todayStr = todayInToronto()
    const valid = (data || []).filter((n) => {
      if (n.expires_at) return new Date(n.expires_at) > now
      if (n.scheduled_date && n.scheduled_date < todayStr) return false
      return true
    })
    setNotes(valid)

    // Load this walker's acks for today.
    if (userId) {
      const today = todayInToronto()
      const { data: acks } = await supabase
        .from('owl_note_acks')
        .select('note_id')
        .eq('walker_id', userId)
        .eq('ack_date', today)
      setMyAcks(new Set((acks || []).map((a) => a.note_id)))
    }

    setLoading(false)
  }, [permissions?.canSeeAllSectors, userSector, userId])

  useEffect(() => {
    load()
  }, [load])

  // Backfill on realtime resync (audit 2026-05-13 HIGH #2).
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    load()
  }, [lastResyncAt, load])

  // Realtime: owl_notes table (everyone subscribes; sector filter applied client-side).
  useEffect(() => {
    const channelName = `owl-notes-realtime-${userSector || 'all'}`
    return subscribeShared(
      {
        name: channelName,
        config: {
          event: '*',
          schema: 'public',
          table: 'owl_notes',
        },
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const note = payload.new
          if (!permissions?.canSeeAllSectors && userSector && userSector !== 'both') {
            if (note.target_sector && note.target_sector !== userSector) return
            if (!note.target_sector && note.target_dog_id) return
          }
          setNotes((prev) => [note, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          const note = payload.new
          // Re-apply load()'s validity filter (line ~95): an UPDATE that pushes
          // expires_at into the past — e.g. the Studio "Map from the Flag" resolve
          // expiring a Fuzzy Match note — must DROP the note now, not just swap in
          // the expired row. activeNotes never re-checks expires_at, so a plain
          // .map() would leave a resolved note on the walker's screen until the
          // next load()/resync.
          const stillValid = note.expires_at
            ? new Date(note.expires_at) > new Date()
            : !(note.scheduled_date && note.scheduled_date < todayInToronto())
          setNotes((prev) =>
            stillValid
              ? prev.map((n) => (n.id === note.id ? note : n))
              : prev.filter((n) => n.id !== note.id),
          )
        } else if (payload.eventType === 'DELETE') {
          setNotes((prev) => prev.filter((n) => n.id !== payload.old.id))
        }
      },
    )
  }, [permissions?.canSeeAllSectors, userSector])

  // Realtime: owl_note_acks for THIS walker only. Other walkers' acks never affect this UI.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`owl-note-acks-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'owl_note_acks',
          filter: `walker_id=eq.${userId}`,
        },
        (payload) => {
          const today = todayInToronto()
          if (payload.eventType === 'INSERT') {
            const row = payload.new
            if (row?.ack_date === today) {
              setMyAcks((prev) => {
                const next = new Set(prev)
                next.add(row.note_id)
                return next
              })
            }
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old
            if (row?.note_id) {
              setMyAcks((prev) => {
                const next = new Set(prev)
                next.delete(row.note_id)
                return next
              })
            }
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Create a new owl note.
  // Wheel 1 Bug 2: default expires_at to end-of-day-in-Toronto of scheduled_date
  // when no duration tail and no explicit expiresAt is provided.
  const createNote = useCallback(
    async ({ noteText, targetType, targetDogId, targetDogName, targetSector, expiresAt, scheduledDate }) => {
      if (!user) return
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

      const { cleanText, expiresAt: parsedExpiry } = parseDuration(noteText)
      const effectiveScheduledDate = scheduledDate || todayInToronto()
      const finalExpiry = expiresAt || parsedExpiry || endOfDayInTorontoISO(effectiveScheduledDate)

      const { error } = await supabase.from('owl_notes').insert({
        note_text: cleanText,
        target_type: targetType,
        target_dog_id: targetDogId || null,
        target_dog_name: targetDogName || null,
        target_sector: targetSector || null,
        expires_at: finalExpiry,
        scheduled_date: effectiveScheduledDate,
        created_by: user.id,
        created_by_name: profile?.full_name || 'Unknown',
      })

      if (error) {
        toast.error('Failed to create note')
      } else {
        toast.success('Note sent!')
      }
    },
    [user, profile],
  )

  // Acknowledge a note.
  // Note WITH expires_at (duration): insert a per-walker ack row for today. Hides for THIS walker only.
  // Note WITHOUT expires_at: legacy "delete permanently" behavior preserved.
  const acknowledgeNote = useCallback(
    async (noteId) => {
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
      const note = notes.find((n) => n.id === noteId)
      if (!user) return

      if (note && note.expires_at) {
        const today = todayInToronto()
        // Optimistic local hide.
        setMyAcks((prev) => {
          const next = new Set(prev)
          next.add(noteId)
          return next
        })
        const { error } = await supabase.from('owl_note_acks').insert({
          note_id: noteId,
          walker_id: user.id,
          ack_date: today,
        })
        if (error && error.code !== '23505') {
          // Roll back optimistic state; surface error.
          setMyAcks((prev) => {
            const next = new Set(prev)
            next.delete(noteId)
            return next
          })
          toast.error('Failed to acknowledge note')
        } else {
          toast('🦉 Got it! This note will return tomorrow.')
        }
      } else {
        const { error } = await supabase.from('owl_notes').delete().eq('id', noteId)
        if (error) {
          toast.error('Failed to acknowledge note')
        } else {
          toast('Got it!')
        }
      }
    },
    [notes, user],
  )

  // Admin delete.
  const deleteNote = useCallback(async (noteId) => {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    const { error } = await supabase.from('owl_notes').delete().eq('id', noteId)
    if (error) toast.error('Failed to delete note')
    else toast('🦉 Note removed')
  }, [])

  // Split notes by visibility for this walker.
  const today = todayInToronto()
  const activeNotes = notes.filter((n) => {
    if (n.scheduled_date && n.scheduled_date > today) return false
    if (n.expires_at && myAcks.has(n.id)) return false
    if (!permissions?.canSeeAllSectors && userSector && userSector !== 'both') {
      if (n.target_sector) {
        if (n.target_sector !== userSector) return false
      } else if (n.target_dog_id) {
        return false
      }
    }
    return true
  })
  const scheduledNotes = notes.filter((n) => n.scheduled_date && n.scheduled_date > today)

  const dogNotes = useCallback(
    (dogId) => activeNotes.filter((n) => n.target_type === 'dog' && n.target_dog_id === dogId),
    [activeNotes],
  )

  const sectorNotes = useCallback(
    (sectorName) =>
      activeNotes.filter(
        (n) =>
          (n.target_type === 'sector' && n.target_sector === sectorName) || n.target_type === 'all',
      ),
    [activeNotes],
  )

  return {
    notes: activeNotes,
    scheduledNotes,
    dogNotes,
    sectorNotes,
    allNotes: activeNotes.filter((n) => n.target_type === 'all'),
    createNote,
    acknowledgeNote,
    deleteNote,
    loading,
  }
}
