import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function WalkerNotesSection({ dogId }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dogId) { setLoading(false); return }
    async function fetch() {
      const { data } = await supabase
        .from('walker_notes')
        .select('*')
        .eq('dog_id', dogId)
        .order('created_at', { ascending: false })
        .limit(5)
      setNotes(data || [])
      setLoading(false)
    }
    fetch()
  }, [dogId])

  if (loading || notes.length === 0) return null

  return (
    <div className="bg-amber-50 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base flex-shrink-0">📝</span>
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Recent Notes</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {notes.map((note) => (
          <div key={note.id} className="bg-white rounded-xl px-3 py-2.5 border border-amber-200/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-600">{note.walker_name}</span>
              <span className="text-[10px] text-gray-400">
                {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {note.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {note.message && (
              <p className="text-xs text-gray-600 leading-snug">{note.message}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
