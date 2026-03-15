import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useOwlNotes } from '../lib/useOwlNotes'

const CORAL = '#E8634A'
const SECTORS = ['Plateau', 'Laurier']

/**
 * Compute a human-friendly remaining-time string from an ISO expiry date.
 */
function timeRemaining(expiresAt) {
  if (!expiresAt) return null
  const now = new Date()
  const exp = new Date(expiresAt)
  const diffMs = exp - now
  if (diffMs <= 0) return 'Expired'

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days < 7) return `${days} days left`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return '1 week left'
  if (days < 30) return `${weeks} weeks left`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month left'
  return `${months} months left`
}

/**
 * Target badge component for displaying what a note targets.
 */
function TargetBadge({ note }) {
  if (note.target_type === 'dog') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: '#FFF4F1', color: CORAL }}>
        🐕 {note.target_dog_name || 'Dog'}
      </span>
    )
  }
  if (note.target_type === 'sector') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        📍 {note.target_sector || 'Sector'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
      🌐 Everyone
    </span>
  )
}

export default function OwlNotesTab() {
  const { isAdmin } = useAuth()
  const { notes, scheduledNotes, createNote, deleteNote, loading } = useOwlNotes()

  // Dog list for autocomplete
  const [dogs, setDogs] = useState([])
  useEffect(() => {
    async function fetchDogs() {
      const { data } = await supabase
        .from('dogs')
        .select('id, dog_name')
        .order('dog_name')
      if (data) setDogs(data)
    }
    fetchDogs()
  }, [])

  // Form state
  const [text, setText] = useState('')
  const [targetType, setTargetType] = useState(null)
  const [targetDogId, setTargetDogId] = useState(null)
  const [targetDogName, setTargetDogName] = useState(null)
  const [targetSector, setTargetSector] = useState(null)
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0])
  const [sending, setSending] = useState(false)

  // Autocomplete state
  const [showDropdown, setShowDropdown] = useState(false)
  const [atQuery, setAtQuery] = useState('')
  const [dropdownIndex, setDropdownIndex] = useState(0)
  const textareaRef = useRef(null)

  // Build autocomplete options
  const autocompleteOptions = useMemo(() => {
    const q = atQuery.toLowerCase()
    const specials = [
      ...SECTORS.map((s) => ({ type: 'sector', label: s, value: s })),
      { type: 'all', label: 'All', value: 'all' },
    ]
    const dogOptions = dogs.map((d) => ({
      type: 'dog',
      label: d.dog_name,
      value: d.id,
      dogName: d.dog_name,
    }))
    const all = [...specials, ...dogOptions]
    if (!q) return all.slice(0, 8)
    return all.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8)
  }, [atQuery, dogs])

  // Handle text change — detect @ trigger
  function handleTextChange(e) {
    const val = e.target.value
    setText(val)

    // Find the last @ in the text
    const lastAt = val.lastIndexOf('@')
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1)
      // Only show dropdown if there's no space yet after @ or it's a short query
      if (!afterAt.includes(' ') || afterAt.length <= 20) {
        setAtQuery(afterAt.replace(/\s+$/, ''))
        setShowDropdown(true)
        setDropdownIndex(0)
        return
      }
    }
    setShowDropdown(false)
  }

  // Handle keyboard navigation in dropdown
  function handleKeyDown(e) {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropdownIndex((i) => Math.min(i + 1, autocompleteOptions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropdownIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && showDropdown && autocompleteOptions.length > 0) {
      e.preventDefault()
      selectOption(autocompleteOptions[dropdownIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  // Select an autocomplete option
  function selectOption(option) {
    const lastAt = text.lastIndexOf('@')
    const before = text.slice(0, lastAt)
    const newText = `${before}@${option.label} `

    setText(newText)
    setShowDropdown(false)

    if (option.type === 'dog') {
      setTargetType('dog')
      setTargetDogId(option.value)
      setTargetDogName(option.dogName)
      setTargetSector(null)
    } else if (option.type === 'sector') {
      setTargetType('sector')
      setTargetSector(option.value)
      setTargetDogId(null)
      setTargetDogName(null)
    } else if (option.type === 'all') {
      setTargetType('all')
      setTargetDogId(null)
      setTargetDogName(null)
      setTargetSector(null)
    }

    // Re-focus textarea
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  // Send note
  async function handleSend() {
    if (!text.trim() || !targetType) return
    setSending(true)

    await createNote({
      noteText: text.trim(),
      targetType,
      targetDogId,
      targetDogName,
      targetSector,
      scheduledDate,
    })

    setText('')
    setTargetType(null)
    setTargetDogId(null)
    setTargetDogName(null)
    setTargetSector(null)
    setScheduledDate(new Date().toISOString().split('T')[0])
    setSending(false)
  }

  // Clear target
  function clearTarget() {
    setTargetType(null)
    setTargetDogId(null)
    setTargetDogName(null)
    setTargetSector(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Note creation form */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">New Owl Note</h3>

        {/* Target badge */}
        {targetType && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">To:</span>
            {targetType === 'dog' && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: '#FFF4F1', color: CORAL }}>
                🐕 {targetDogName}
              </span>
            )}
            {targetType === 'sector' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                📍 {targetSector}
              </span>
            )}
            {targetType === 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                🌐 Everyone
              </span>
            )}
            <button onClick={clearTarget} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}

        {/* Textarea with autocomplete */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type @ to mention a dog, sector, or @all..."
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-gray-300"
            style={{ focusBorderColor: CORAL }}
          />

          {/* Autocomplete dropdown */}
          {showDropdown && autocompleteOptions.length > 0 && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {autocompleteOptions.map((option, i) => (
                <button
                  key={`${option.type}-${option.value}`}
                  onClick={() => selectOption(option)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    i === dropdownIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-gray-400">
                    {option.type === 'dog' ? '🐕' : option.type === 'sector' ? '📍' : '🌐'}
                  </span>
                  <span className="text-gray-700">{option.label}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {option.type === 'dog' ? 'dog' : option.type === 'sector' ? 'sector' : 'everyone'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Duration hint */}
        <p className="mt-1 text-xs text-gray-400">
          Tip: Add <span className="font-mono text-gray-500">(3 days)</span> at end for auto-expiry
        </p>

        {/* Schedule date picker */}
        <div className="mt-2 flex items-center gap-2">
          <label className="text-xs text-gray-500">Appears on:</label>
          <input
            type="date"
            value={scheduledDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-300"
          />
          {scheduledDate > new Date().toISOString().split('T')[0] && (
            <span className="text-xs text-amber-600">📅 Scheduled</span>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || !targetType || sending}
          className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: CORAL }}
        >
          {sending ? 'Sending...' : 'Send Note'}
        </button>
      </div>

      {/* Active notes list */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          Active Notes {notes.length > 0 && <span className="text-gray-400">({notes.length})</span>}
        </h3>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No active owl notes</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <TargetBadge note={note} />
                    {note.expires_at && (
                      <span className="text-xs text-gray-400">
                        {timeRemaining(note.expires_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{note.note_text}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-amber-600">🦉 Waiting...</span>
                    {note.created_by_name && (
                      <span className="text-xs text-gray-400">— {note.created_by_name}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteNote(note.id)}
                  className="shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-100"
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled notes (future-dated) */}
      {scheduledNotes.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-400">
            📅 Scheduled Notes <span className="text-gray-300">({scheduledNotes.length})</span>
          </h3>
          <div className="flex flex-col gap-2">
            {scheduledNotes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 opacity-60"
              >
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <TargetBadge note={note} />
                    <span className="text-xs text-gray-400">
                      Appears {note.scheduled_date}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{note.note_text}</p>
                  <div className="mt-1">
                    {note.created_by_name && (
                      <span className="text-xs text-gray-400">— {note.created_by_name}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteNote(note.id)}
                  className="shrink-0 rounded-full p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-100"
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
