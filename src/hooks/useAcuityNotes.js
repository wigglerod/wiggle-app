import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAcuityNotes(dogId) {
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dogId) { setLoading(false); return }

    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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
