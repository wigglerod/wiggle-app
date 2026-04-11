import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Fetches walker-submitted flags from walker_notes.
 * A "walker flag" is a row with note_type='note' and 'flag' in tags[].
 * Scoped to today's walk_date.
 */
export default function useWalkerFlags() {
  const [walkerFlags, setWalkerFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' })

      const { data, error: fetchErr } = await supabase
        .from('walker_notes')
        .select('id, dog_id, dog_name, walker_name, message, tags, created_at, walk_date')
        .contains('tags', ['flag'])
        .eq('walk_date', today)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      setWalkerFlags(data || [])
    } catch (e) {
      setError(e.message || 'Failed to load walker flags')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  /**
   * Resolve a walker flag by removing 'flag' from its tags array.
   * Follows the existing fetch-then-update pattern (TowerMiniGen.jsx).
   * Returns { success: true } or throws.
   */
  const resolveFlag = useCallback(async (noteId) => {
    // Read current tags
    const { data: row, error: readErr } = await supabase
      .from('walker_notes')
      .select('tags')
      .eq('id', noteId)
      .single()

    if (readErr) throw readErr

    const newTags = (row.tags || []).filter(t => t !== 'flag')

    const { error: updateErr } = await supabase
      .from('walker_notes')
      .update({ tags: newTags.length ? newTags : null })
      .eq('id', noteId)

    if (updateErr) throw updateErr
    return { success: true }
  }, [])

  return { walkerFlags, loading, error, refetch: fetch_, resolveFlag }
}
