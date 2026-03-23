import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DogPhoto } from './DogChip'

export default function GroupCreationSheet({ open, onClose, onCreate, availableWalkers = [], nextGroupNum }) {
  const [name, setName] = useState('')
  const [selectedWalkers, setSelectedWalkers] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setName('')
      setSelectedWalkers([])
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  function toggleWalker(id) {
    setSelectedWalkers(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    )
  }

  function handleCreate() {
    const groupName = name.trim() || `Group ${nextGroupNum}`
    onCreate(groupName, selectedWalkers)
    onClose()
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl pb-[env(safe-area-inset-bottom)]"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-4 pb-6">
          <h3 className="text-[15px] font-bold text-gray-800 mb-3">New Group</h3>

          {/* Name input */}
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Group name... (default: Group ${nextGroupNum})`}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#E8634A] min-h-[48px] mb-4"
          />

          {/* Walker picker */}
          {availableWalkers.length > 0 && (
            <>
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">
                Assign walkers
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {availableWalkers.map((w) => {
                  const isSelected = selectedWalkers.includes(w.id)
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleWalker(w.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium transition-all select-none min-h-[36px] ${
                        isSelected
                          ? 'bg-[#E8634A] text-white shadow-sm'
                          : 'bg-gray-50 text-gray-700 border border-gray-200 active:bg-gray-100'
                      }`}
                    >
                      <DogPhoto
                        dog={{ photo_url: null }}
                        displayName={w.full_name}
                        size={20}
                      />
                      {w.full_name?.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Create button */}
          <button
            onClick={handleCreate}
            className="w-full py-3.5 rounded-xl bg-[#E8634A] text-white font-bold text-[13px] shadow-sm active:bg-[#d4552d] transition-all min-h-[48px]"
          >
            Create Group
          </button>
        </div>
      </motion.div>
    </>
  )
}
