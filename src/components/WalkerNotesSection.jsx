import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'

export default function WalkerNotesSection({ dogId }) {
  const { user } = useAuth()
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
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">
                  {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
                {user?.id === note.walker_id && (
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from('walker_notes').delete().eq('id', note.id)
                      if (!error) {
                         setNotes(prev => prev.filter(n => n.id !== note.id))
                         toast.success('Note deleted')
                      }
                    }}
                    className="text-gray-400 hover:text-red-500 active:text-red-600 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                )}
              </div>
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
            {note.note_type && note.note_type !== 'general' && !note.message && (
               <p className="text-xs text-gray-500 italic">{note.note_type.replace('_', ' ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
