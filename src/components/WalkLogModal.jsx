import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatTime } from '../lib/parseICS'

const STATUS_OPTIONS = [
  { value: 'completed', label: '✅ Walk Completed', color: 'bg-green-50 border-green-400 text-green-800' },
  { value: 'skipped', label: '⚠️ Skipped / Issue', color: 'bg-amber-50 border-amber-400 text-amber-800' },
  { value: 'incident', label: '🐾 Health / Behaviour Incident', color: 'bg-red-50 border-red-400 text-red-800' },
]

export default function WalkLogModal({ group, onClose, onLogged }) {
  const { user } = useAuth()
  const [selectedDogs, setSelectedDogs] = useState(() =>
    new Set(group.events.map((ev) => ev._id))
  )
  const [status, setStatus] = useState('completed')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggleDog(id) {
    setSelectedDogs((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (selectedDogs.size === 0) return
    setSaving(true)
    setError(null)

    const selected = group.events.filter((ev) => selectedDogs.has(ev._id))
    const matched = selected.filter((ev) => ev.dog?.id)
    const unmatched = selected.filter((ev) => !ev.dog?.id)

    if (matched.length > 0) {
      const logs = matched.map((ev) => ({
        walker_id: user?.id,
        dog_id: ev.dog.id,
        walk_date: group.startTime.toISOString().split('T')[0],
        status,
        notes: notes.trim() || null,
      }))

      const { error: dbError } = await supabase.from('walk_logs').insert(logs)

      if (dbError) {
        console.warn('Walk log insert failed:', dbError.message)
        setError('Failed to save walk log. Please try again.')
        setSaving(false)
        return
      }
    }

    if (unmatched.length > 0) {
      console.warn(
        'Skipped logging for unmatched dogs:',
        unmatched.map((ev) => ev.displayName).join(', ')
      )
    }

    onLogged([...selectedDogs])
    setSaving(false)
    onClose()
  }

  const needsNotes = status === 'skipped' || status === 'incident'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Log Walk</h2>
            <p className="text-sm text-gray-400">
              {formatTime(group.startTime)} – {formatTime(group.endTime)}
            </p>
          </div>

          {/* Dog selection */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Select Dogs</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {group.events.map((ev) => (
              <button
                key={ev._id}
                onClick={() => toggleDog(ev._id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  selectedDogs.has(ev._id)
                    ? 'bg-[#E8634A] text-white border-[#E8634A]'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                {ev.displayName}
              </button>
            ))}
          </div>

          {/* Warning for unmatched dogs */}
          {group.events.some((ev) => selectedDogs.has(ev._id) && !ev.dog?.id) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs text-amber-700">
              Dogs without a profile won't be saved to the walk log. Tap their name in the schedule to create a profile.
            </div>
          )}

          {/* Status selection */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Walk Status</p>
          <div className="flex flex-col gap-2 mb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                  status === opt.value ? opt.color : 'bg-gray-50 border-gray-100 text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Notes */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Notes {needsNotes && <span className="text-red-400">(required)</span>}
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                status === 'incident'
                  ? 'Describe the health or behaviour incident...'
                  : 'Add any notes about this walk...'
              }
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8634A] focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || selectedDogs.size === 0 || (needsNotes && !notes.trim())}
            className="w-full py-3.5 rounded-xl bg-[#E8634A] text-white font-bold text-sm shadow-sm active:bg-[#d4552d] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Saving...' : 'Submit Walk Log'}
          </button>
        </div>
      </div>
    </>
  )
}
