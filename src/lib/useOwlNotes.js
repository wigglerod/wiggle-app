import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
import { subscribeShared } from './sharedRealtimeChannel'
import { assertFreshOrThrow, StaleBundleError } from './freshBundle'
import { useAuth } from '../context/AuthContext'

/**
 * Parse duration syntax from the end of note text.
 * Supports: (3 days), (2 weeks), (1 month), etc.
 * Returns { cleanText, expiresAt } where expiresAt is an ISO string or null.
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

/**
 * Hook for managing owl notes with Supabase persistence + realtime sync.
 *
 * Owl notes are short messages that can target a specific dog, a sector, or everyone.
 * They optionally auto-expire after a parsed duration.
 */
export function useOwlNotes(sector) {
  const { user, profile, permissions } = useAuth()
  const userSector = profile?.sector
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch non-expired notes and clean up expired ones
  useEffect(() => {
    async function load() {
      setLoading(true)

      // Delete expired notes
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
      await supabase
        .from('owl_notes')
        .delete()
        .lt('expires_at', new Date().toISOString())

      // Fetch remaining notes — walkers only see their sector + global notes
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

      // Filter out any that might have expired between delete and select
      const now = new Date()
      const valid = (data || []).filter(
        (n) => !n.expires_at || new Date(n.expires_at) > now
      )

      setNotes(valid)
      setLoading(false)
    }

    load()
  }, [permissions?.canSeeAllSectors, userSector])

  // Realtime subscription
  // Shared channel: hook mounts concurrently in Dashboard + Header (owl count)
  // + OwlQuickDrawer + DogProfileDrawer. Sharing keeps it to one subscription.
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
          // Sector filter for walkers on realtime events
          if (!permissions?.canSeeAllSectors && userSector && userSector !== 'both') {
            if (note.target_sector && note.target_sector !== userSector) return
            if (!note.target_sector && note.target_dog_id) return
          }
          setNotes((prev) => [note, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setNotes((prev) =>
            prev.map((n) => (n.id === payload.new.id ? payload.new : n))
          )
        } else if (payload.eventType === 'DELETE') {
          setNotes((prev) => prev.filter((n) => n.id !== payload.old.id))
        }
      }
    )
  }, [permissions?.canSeeAllSectors, userSector])

  // Create a new owl note
  const createNote = useCallback(
    async ({ noteText, targetType, targetDogId, targetDogName, targetSector, expiresAt, scheduledDate }) => {
      if (!user) return
      try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

      // Parse duration from text if no explicit expiresAt
      const { cleanText, expiresAt: parsedExpiry } = parseDuration(noteText)
      const finalExpiry = expiresAt || parsedExpiry

      const { error } = await supabase.from('owl_notes').insert({
        note_text: cleanText,
        target_type: targetType,
        target_dog_id: targetDogId || null,
        target_dog_name: targetDogName || null,
        target_sector: targetSector || null,
        expires_at: finalExpiry,
        scheduled_date: scheduledDate || new Date().toISOString().split('T')[0],
        created_by: user.id,
        created_by_name: profile?.full_name || 'Unknown',
      })

      if (error) {
        toast.error('Failed to create note')
      } else {
        toast.success('Note sent!')
      }
    },
    [user, profile]
  )

  // Acknowledge a note — daily ack for notes with duration, delete for notes without
  const acknowledgeNote = useCallback(async (noteId) => {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    // Find the note to check if it has a duration (expires_at)
    const note = notes.find(n => n.id === noteId)

    if (note && note.expires_at) {
      // Note WITH duration: mark as acknowledged today, don't delete
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase
        .from('owl_notes')
        .update({
          last_acknowledged_date: today,
          acknowledged_by: user?.id || null,
          acknowledged_by_name: profile?.full_name || 'Unknown',
        })
        .eq('id', noteId)

      if (error) {
        toast.error('Failed to acknowledge note')
      } else {
        // Update local state to hide immediately
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, last_acknowledged_date: today } : n))
        toast('🦉 Got it! This note will return tomorrow.')
      }
    } else {
      // Note WITHOUT duration: delete permanently
      const { error } = await supabase
        .from('owl_notes')
        .delete()
        .eq('id', noteId)

      if (error) {
        toast.error('Failed to acknowledge note')
      } else {
        toast('Got it!')
      }
    }
  }, [notes, user, profile])

  // Admin delete a note
  const deleteNote = useCallback(async (noteId) => {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    const { error } = await supabase
      .from('owl_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      toast.error('Failed to delete note')
    } else {
      toast('🦉 Note removed')
    }
  }, [])

  // Split notes into active (scheduled_date <= today) and scheduled (future)
  // For notes with duration: hide if acknowledged today
  // For walkers: filter to their sector only
  const today = new Date().toISOString().split('T')[0]
  const activeNotes = notes.filter((n) => {
    if (n.scheduled_date && n.scheduled_date > today) return false
    if (n.expires_at && n.last_acknowledged_date === today) return false
    // Sector filter for walkers
    if (!permissions?.canSeeAllSectors && userSector && userSector !== 'both') {
      if (n.target_sector) {
        if (n.target_sector !== userSector) return false
      } else if (n.target_dog_id) {
        // null target_sector but targets a specific dog — hide (likely other sector)
        return false
      }
      // null target_sector + null target_dog_id = global note, show to everyone
    }
    return true
  })
  const scheduledNotes = notes.filter(
    (n) => n.scheduled_date && n.scheduled_date > today
  )

  // Filter helpers — only return active (visible) notes
  const dogNotes = useCallback(
    (dogId) =>
      activeNotes.filter((n) => n.target_type === 'dog' && n.target_dog_id === dogId),
    [activeNotes]
  )

  const sectorNotes = useCallback(
    (sectorName) =>
      activeNotes.filter(
        (n) =>
          (n.target_type === 'sector' && n.target_sector === sectorName) ||
          n.target_type === 'all'
      ),
    [activeNotes]
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
