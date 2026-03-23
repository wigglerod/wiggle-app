import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DogPhoto } from './DogChip'

const TAGS = [
  { label: 'DM Me',                style: 'amber' },
  { label: 'Seems off',            style: 'red' },
  { label: 'Reactive',             style: 'red' },
  { label: 'Limping',              style: 'red' },
  { label: 'Refuse to walk',       style: 'red' },
  { label: 'Wounded',              style: 'red' },
  { label: 'Soft stool / diarrhea', style: 'red' },
  { label: 'Great walk!',          style: 'green' },
  { label: 'Sooo happyy',          style: 'green' },
]

const TAG_STYLES = {
  amber:  { bg: '#FAEEDA', border: '#FAC775', text: '#412402', activeBg: '#FAC775', activeText: '#412402' },
  red:    { bg: '#FCEBEB', border: '#F09595', text: '#791F1F', activeBg: '#F09595', activeText: '#791F1F' },
  green:  { bg: '#E1F5EE', border: '#5DCAA5', text: '#04342C', activeBg: '#5DCAA5', activeText: '#04342C' },
}

export default function QuickNoteSheet({ open, onClose, walkingDogs, date, preSelectedDog }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState('dog')
  const [selectedDog, setSelectedDog] = useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setSelectedTags([])
      setMessage('')
      setSaving(false)
      if (preSelectedDog) {
        setSelectedDog(preSelectedDog)
        setStep('note')
      } else {
        setStep('dog')
        setSelectedDog(null)
      }
    }
  }, [open, preSelectedDog])

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

    const { error } = await supabase.from('walker_notes').insert({
      dog_id: selectedDog.dogId || null,
      dog_name: selectedDog.displayName || selectedDog.dog_name || 'Unknown',
      walker_id: user.id,
      walker_name: profile?.full_name || 'Walker',
      note_type: message.trim() ? 'text' : 'tag',
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

  if (!open) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
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
                      className="flex items-center gap-2 px-3 py-3 rounded-xl bg-gray-50 border border-gray-200 active:bg-[#FFF5F0] active:border-[#E8634A] transition-all text-left min-h-[48px]"
                    >
                      <DogPhoto dog={dog} displayName={dog.displayName || dog.dog_name} size={24} />
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
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => preSelectedDog ? onClose() : setStep('dog')}
                    className="text-sm text-gray-400 active:text-gray-600 min-h-[44px] flex items-center"
                  >
                    {preSelectedDog ? '\u2715 Close' : '\u2190 Back'}
                  </button>
                  <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <DogPhoto dog={selectedDog} displayName={selectedDog?.displayName || selectedDog?.dog_name} size={20} />
                    {selectedDog?.displayName || selectedDog?.dog_name}
                  </span>
                  <div className="w-12" />
                </div>

                {/* Tags grid — styled by type */}
                <div className="flex flex-col gap-1.5 mb-4">
                  {TAGS.map(({ label, style }) => {
                    const active = selectedTags.includes(label)
                    const s = TAG_STYLES[style]
                    return (
                      <button
                        key={label}
                        onClick={() => toggleTag(label)}
                        className="flex items-center px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all min-h-[44px]"
                        style={active
                          ? { backgroundColor: s.activeBg, color: s.activeText, border: `1.5px solid ${s.activeBg}` }
                          : { backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }
                        }
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Free text input — no voice memo */}
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A] min-h-[48px] mb-4"
                />

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
