import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useOwlNotes } from '../lib/useOwlNotes'
import { useAuth } from '../context/AuthContext'

const CORAL = '#E8634A'
const SECTORS = ['Plateau', 'Laurier']

export default function OwlQuickDrawer({ open, onClose }) {
  const { notes, createNote, loading } = useOwlNotes()
  const { permissions, sector: userSector } = useAuth()

  // Dog list for autocomplete — fetch once and cache, scoped by sector for walkers
  const [dogs, setDogs] = useState([])
  const dogsFetched = useRef(false)
  useEffect(() => {
    if (!open || dogsFetched.current) return
    async function fetchDogs() {
      let query = supabase.from('dogs').select('id, dog_name, sector').order('dog_name')
      if (!permissions.canSeeAllSectors && userSector && userSector !== 'both') {
        query = query.eq('sector', userSector)
      }
      const { data } = await query
      if (data) {
        setDogs(data)
        dogsFetched.current = true
      }
    }
    fetchDogs()
  }, [open, permissions.canSeeAllSectors, userSector])

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
      dogSector: d.sector,
    }))
    const all = [...specials, ...dogOptions]
    if (!q) return all.slice(0, 8)
    return all.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8)
  }, [atQuery, dogs])

  function handleTextChange(e) {
    const val = e.target.value
    setText(val)
    const lastAt = val.lastIndexOf('@')
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1)
      if (!afterAt.includes(' ') || afterAt.length <= 20) {
        setAtQuery(afterAt.replace(/\s+$/, ''))
        setShowDropdown(true)
        setDropdownIndex(0)
        return
      }
    }
    setShowDropdown(false)
  }

  function handleKeyDown(e) {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropdownIndex((i) => Math.min(i + 1, autocompleteOptions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropdownIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && autocompleteOptions.length > 0) {
      e.preventDefault()
      selectOption(autocompleteOptions[dropdownIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  function selectOption(option) {
    const lastAt = text.lastIndexOf('@')
    const before = text.slice(0, lastAt)
    setText(`${before}@${option.label} `)
    setShowDropdown(false)

    if (option.type === 'dog') {
      setTargetType('dog')
      setTargetDogId(option.value)
      setTargetDogName(option.dogName)
      setTargetSector(option.dogSector || null)
    } else if (option.type === 'sector') {
      setTargetType('sector')
      setTargetSector(option.value)
      setTargetDogId(null)
      setTargetDogName(null)
    } else {
      setTargetType('all')
      setTargetDogId(null)
      setTargetDogName(null)
      setTargetSector(null)
    }
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function clearTarget() {
    setTargetType(null)
    setTargetDogId(null)
    setTargetDogName(null)
    setTargetSector(null)
  }

  async function handleSend() {
    if (!text.trim() || !targetType) return
    setSending(true)
    await createNote({ noteText: text.trim(), targetType, targetDogId, targetDogName, targetSector, scheduledDate })
    setText('')
    setTargetType(null)
    setTargetDogId(null)
    setTargetDogName(null)
    setTargetSector(null)
    setScheduledDate(new Date().toISOString().split('T')[0])
    setSending(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-2xl max-w-lg mx-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="px-4 pb-6 pt-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <span className="text-base">🦉</span> Quick Owl Note
                </h3>
                <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Target badge */}
              {targetType && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">To:</span>
                  {targetType === 'dog' && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: '#FFF4F1', color: CORAL }}>
                      {targetDogName}
                    </span>
                  )}
                  {targetType === 'sector' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {targetSector}
                    </span>
                  )}
                  {targetType === 'all' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      Everyone
                    </span>
                  )}
                  <button onClick={clearTarget} className="text-xs text-gray-400">✕</button>
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
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-gray-300"
                  autoFocus
                />

                {showDropdown && autocompleteOptions.length > 0 && (
                  <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {autocompleteOptions.map((option, i) => (
                      <button
                        key={`${option.type}-${option.value}`}
                        onClick={() => selectOption(option)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          i === dropdownIndex ? 'bg-gray-100' : ''
                        }`}
                      >
                        <span className="text-gray-400">
                          {option.type === 'dog' ? '🐕' : option.type === 'sector' ? '📍' : '🌐'}
                        </span>
                        <span className="text-gray-700">{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-1 text-xs text-gray-400">
                Tip: Add <span className="font-mono text-gray-500">(3 days)</span> for auto-expiry
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

              <button
                onClick={handleSend}
                disabled={!text.trim() || !targetType || sending}
                className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80 min-h-[44px]"
                style={{ backgroundColor: CORAL }}
              >
                {sending ? 'Sending...' : 'Send Note'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function useOwlNoteCount() {
  const { notes } = useOwlNotes()
  return notes.length
}
