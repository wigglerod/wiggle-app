import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAcuityNotes(dogId) {
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dogId) { setLoading(false); return }

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' })

    supabase
      .from('acuity_notes')
      .select('note_text, booking_date')
      .eq('dog_id', dogId)
      .eq('booking_date', today)
      .maybeSingle()
      .then(({ data }) => {
        setNote(data || null)
        setLoading(false)
      })
  }, [dogId])

  return { note, loading }
}
