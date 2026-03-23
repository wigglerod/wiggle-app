import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function getTodayDayName() {
  return DAY_NAMES[new Date().getDay()]
}

/**
 * Hook to fetch alternate addresses for a dog.
 * Returns { altAddresses, todayAlt, loading, refetch }
 *  - altAddresses: all alt address rows for this dog
 *  - todayAlt: the alt address for today's day (or null)
 */
export function useAltAddress(dogId) {
  const [altAddresses, setAltAddresses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!dogId) { setLoading(false); return }
    const { data } = await supabase
      .from('dog_alt_addresses')
      .select('*')
      .eq('dog_id', dogId)
      .order('day_of_week')
    setAltAddresses(data || [])
    setLoading(false)
  }, [dogId])

  useEffect(() => { fetch() }, [fetch])

  const today = getTodayDayName()
  const todayAlt = altAddresses.find(a => a.day_of_week === today) || null

  return { altAddresses, todayAlt, loading, refetch: fetch }
}

/**
 * Batch-fetch which dogs have alt addresses for today.
 * Returns a Set of dog IDs that have an alt address today.
 */
export function useAltAddressDogIds(dogIds) {
  const [altDogIds, setAltDogIds] = useState(new Set())

  useEffect(() => {
    if (!dogIds || dogIds.length === 0) return
    const today = getTodayDayName()
    async function fetch() {
      const { data } = await supabase
        .from('dog_alt_addresses')
        .select('dog_id')
        .eq('day_of_week', today)
        .in('dog_id', dogIds)
      setAltDogIds(new Set((data || []).map(d => d.dog_id)))
    }
    fetch()
  }, [dogIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return altDogIds
}
