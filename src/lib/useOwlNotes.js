import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from './supabase'
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
  const { user, profile } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch non-expired notes and clean up expired ones
  useEffect(() => {
    async function load() {
      setLoading(true)

      // Delete expired notes
      await supabase
        .from('owl_notes')
        .delete()
        .lt('expires_at', new Date().toISOString())

      // Fetch remaining notes
      const { data, error } = await supabase
        .from('owl_notes')
        .select('*')
        .order('created_at', { ascending: false })

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
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('owl-notes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'owl_notes',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotes((prev) => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotes((prev) =>
              prev.map((n) => (n.id === payload.new.id ? payload.new : n))
            )
          } else if (payload.eventType === 'DELETE') {
            setNotes((prev) => prev.filter((n) => n.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Create a new owl note
  const createNote = useCallback(
    async ({ noteText, targetType, targetDogId, targetDogName, targetSector, expiresAt, scheduledDate }) => {
      if (!user) return

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

  // Acknowledge a note — deletes it completely
  const acknowledgeNote = useCallback(async (noteId) => {
    const { error } = await supabase
      .from('owl_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      toast.error('Failed to acknowledge note')
    } else {
      toast('Got it!')
    }
  }, [])

  // Admin delete a note
  const deleteNote = useCallback(async (noteId) => {
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
  const today = new Date().toISOString().split('T')[0]
  const activeNotes = notes.filter(
    (n) => !n.scheduled_date || n.scheduled_date <= today
  )
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
