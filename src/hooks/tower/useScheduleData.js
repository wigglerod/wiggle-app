import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function useScheduleData() {
  const [owlNotes, setOwlNotes] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [altAddresses, setAltAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Active owl notes (not expired)
      const { data: owls, error: owlErr } = await supabase
        .from('owl_notes')
        .select('id, note_text, target_dog_name, target_sector, created_by_name, expires_at, created_at')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })

      if (owlErr) console.warn('owl_notes fetch failed:', owlErr.message)
      setOwlNotes(owls || [])

      // Conflict rules
      const { data: conf, error: confErr } = await supabase
        .from('dog_conflicts')
        .select('id, dog_1_name, dog_2_name, reason, created_at')
        .order('created_at', { ascending: false })

      if (confErr) console.warn('dog_conflicts fetch failed:', confErr.message)
      setConflicts(conf || [])

      // Alt addresses
      const { data: alts, error: altErr } = await supabase
        .from('dog_alt_addresses')
        .select('*')

      if (altErr) console.warn('dog_alt_addresses fetch failed:', altErr.message)
      setAltAddresses(alts || [])
    } catch (e) {
      setError(e.message || 'Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  return { owlNotes, conflicts, altAddresses, loading, error }
}
