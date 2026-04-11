import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Fetches the latest Mini Gen drafts and Mini Gen flags from existing tables.
 * Reads mini_gen_drafts (pending) + walker_notes (note_type='resolver_flag').
 * Call refetch() after approve/reject or after triggering a new run.
 */
export default function useMiniGenResults() {
  const [drafts, setDrafts] = useState([])
  const [miniGenFlags, setMiniGenFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Only show drafts for today or later — past-date pending rows are stale
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' })

      // Pending drafts ordered by walk_date then sector
      const { data: draftRows, error: draftErr } = await supabase
        .from('mini_gen_drafts')
        .select('*')
        .eq('status', 'pending')
        .gte('walk_date', today)
        .order('walk_date')
        .order('sector')

      if (draftErr) throw draftErr
      setDrafts(draftRows || [])

      // Flags scoped to the drafts' date range
      const rows = draftRows || []
      if (rows.length > 0) {
        const minDate = rows.reduce(
          (m, d) => (d.walk_date < m ? d.walk_date : m),
          rows[0].walk_date,
        )
        const { data: flagRows, error: flagErr } = await supabase
          .from('walker_notes')
          .select('id, dog_name, message, walk_date, tags, created_at')
          .eq('note_type', 'resolver_flag')
          .gte('walk_date', minDate)
          .order('walk_date')
          .order('tags')

        if (flagErr) throw flagErr
        setMiniGenFlags(flagRows || [])
      } else {
        setMiniGenFlags([])
      }
    } catch (e) {
      setError(e.message || 'Failed to load Mini Gen results')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  // Derived stats
  const lastRunDate = drafts.length > 0
    ? drafts[0].run_date || drafts[0].walk_date
    : null

  const stats = {
    pendingDrafts: drafts.length,
    flagCount: miniGenFlags.length,
    lastRunDate,
  }

  return { drafts, miniGenFlags, stats, loading, error, refetch: fetch_ }
}
