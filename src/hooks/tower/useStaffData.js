import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const EXCLUDE_NAMES = ['Wiggle Pro', 'Pup Walker']

export default function useStaffData() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('full_name, role, sector, email, schedule')
        .in('role', ['senior_walker', 'junior_walker'])
        .order('role')
        .order('full_name')

      if (err) throw err
      const filtered = (data || []).filter(
        (p) => p.full_name && !EXCLUDE_NAMES.includes(p.full_name),
      )
      setStaff(filtered)
    } catch (e) {
      setError(e.message || 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  return { staff, loading, error }
}
