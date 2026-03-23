import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TAGS = [
  { emoji: '🐕', label: 'Pulled hard' },
  { emoji: '💩', label: 'Soft stool' },
  { emoji: '💩', label: 'Diarrhea' },
  { emoji: '🤒', label: 'Seemed off' },
  { emoji: '😬', label: 'Reactive' },
  { emoji: '🚫', label: 'Refused walk' },
  { emoji: '🐾', label: 'Limping' },
  { emoji: '💧', label: 'Drank a lot' },
  { emoji: '🎉', label: 'Great walk!' },
  { emoji: '⚡', label: 'High energy' },
  { emoji: '😴', label: 'Low energy' },
  { emoji: '🩹', label: 'Scratch/wound' },
]

// Web Speech API support check
const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

export default function QuickNoteSheet({ open, onClose, walkingDogs, date }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState('dog') // 'dog' | 'note'
  const [selectedDog, setSelectedDog] = useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const inputRef = useRef(null)

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setStep('dog')
      setSelectedDog(null)
      setSelectedTags([])
      setMessage('')
      setSaving(false)
      setListening(false)
    }
  }, [open])

  // Auto-advance if only one dog group
  const dogs = useMemo(() => walkingDogs || [], [walkingDogs])

  function selectDog(dog) {
    setSelectedDog(dog)
    setStep('note')
  }

  function toggleTag(label) {
    setSelectedTags(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    )
  }

  async function handleSave() {
    if (!selectedDog || (selectedTags.length === 0 && !message.trim())) return
    setSaving(true)

    const noteType = message.trim()
      ? (listening ? 'voice' : 'text')
      : 'tag'

    const { error } = await supabase.from('walker_notes').insert({
      dog_id: selectedDog.dogId || null,
      dog_name: selectedDog.displayName || selectedDog.dog_name || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: noteType,
      tags: selectedTags.length > 0 ? selectedTags : null,
      message: message.trim() || null,
      walk_date: date,
      group_num: selectedDog.groupNum || null,
    })

    setSaving(false)

    if (error) {
      toast.error('Failed to save note')
    } else {
      if (navigator.vibrate) navigator.vibrate(50)
      toast.success('Note saved')
      onClose()
    }
  }

  function startListening() {
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-4 pb-6">
          <AnimatePresence mode="wait">
            {step === 'dog' ? (
              <motion.div
                key="dog-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
              >
                <h3 className="text-base font-bold text-gray-800 mb-3">Which dog?</h3>
                <div className="grid grid-cols-2 gap-2">
                  {dogs.map((dog, i) => (
                    <button
                      key={dog._id || i}
                      onClick={() => selectDog(dog)}
                      className="flex items-center gap-2 px-3 py-3 rounded-xl bg-gray-50 border border-gray-200 active:bg-[#FFF4F1] active:border-[#E8634A] transition-all text-left min-h-[48px]"
                    >
                      <span className="text-lg">🐕</span>
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {dog.displayName || dog.dog_name}
                      </span>
                    </button>
                  ))}
                </div>
                {dogs.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No dogs in your groups yet</p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="note-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.15 }}
              >
                {/* Selected dog header */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setStep('dog')}
                    className="text-sm text-gray-400 active:text-gray-600 min-h-[44px] flex items-center"
                  >
                    &larr; Back
                  </button>
                  <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
                    🐕 {selectedDog?.displayName || selectedDog?.dog_name}
                  </span>
                  <div className="w-12" />
                </div>

                {/* Tags grid */}
                <div className="grid grid-cols-2 gap-1.5 mb-4">
                  {TAGS.map(({ emoji, label }) => {
                    const active = selectedTags.includes(label)
                    return (
                      <button
                        key={label}
                        onClick={() => toggleTag(label)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                          active
                            ? 'bg-[#E8634A] text-white shadow-sm'
                            : 'bg-gray-50 text-gray-700 border border-gray-200 active:bg-gray-100'
                        }`}
                      >
                        <span className="text-base">{emoji}</span>
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Free text input + mic */}
                <div className="flex gap-2 mb-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A] min-h-[48px]"
                  />
                  {SpeechRecognition && (
                    <button
                      onClick={listening ? stopListening : startListening}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all flex-shrink-0 ${
                        listening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                      }`}
                    >
                      🎙️
                    </button>
                  )}
                </div>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={saving || (selectedTags.length === 0 && !message.trim())}
                  className="w-full py-3.5 rounded-xl bg-[#E8634A] text-white font-bold text-sm shadow-sm active:bg-[#d4552d] disabled:opacity-40 transition-all min-h-[48px]"
                >
                  {saving ? 'Saving...' : 'Save Note'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
