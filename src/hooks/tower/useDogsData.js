import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function useDogsData() {
  const [dogs, setDogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('dogs')
        .select('dog_name, sector, breed, owner_first, owner_last, address, door_code, notes, level')
        .order('sector')
        .order('dog_name')

      if (err) throw err
      setDogs(data || [])
    } catch (e) {
      setError(e.message || 'Failed to load dogs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  return { dogs, loading, error }
}
