import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Fetches the latest Mini Gen drafts and flags from mini_gen_drafts.
 * Flags are derived from each draft's `flags` JSONB (the canonical source);
 * each flag carries its parent draft context so the dashboard can resolve it.
 * Call refetch() after approve/reject/resolve or after triggering a new run.
 */
export default function useMiniGenResults() {
  const [drafts, setDrafts] = useState([])
  const [flags, setFlags] = useState([])
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
      const rows = draftRows || []
      setDrafts(rows)

      // Flags derived from the canonical source — mini_gen_drafts.flags (JSONB).
      // Each flag carries its parent draft context so the dashboard resolver
      // tools (name-map / vacation-remove) can act on the right row.
      const derived = rows.flatMap((d) =>
        (d.flags || []).map((flag, i) => ({
          ...flag,
          id: `${d.id}:${i}`,
          draftId: d.id,
          walk_date: d.walk_date,
          sector: d.sector,
        })),
      )
      setFlags(derived)
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
    flagCount: flags.length,
    lastRunDate,
  }

  return { drafts, flags, stats, loading, error, refetch: fetch_ }
}
