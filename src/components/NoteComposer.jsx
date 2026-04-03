import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useActivityNotes } from '../hooks/useActivityNotes'

const CHIPS = [
  { label: 'Great walk 🐾', id: 'great_walk' },
  { label: 'Tired today', id: 'tired' },
  { label: 'Reactive', id: 'reactive' },
  { label: 'Paw bothering', id: 'paw' },
  { label: 'Extra energy', id: 'energy' },
  { label: '🚩 Flag', id: 'flag', isFlag: true },
]

export default function NoteComposer({ dog, onClose, onSent }) {
  const { user, profile } = useAuth()
  const { writeNote } = useActivityNotes()

  const [selectedChips, setSelectedChips] = useState(new Set())
  const [text, setText] = useState('')
  const [warnNext, setWarnNext] = useState(false)
  const [sending, setSending] = useState(false)

  const isFlagSelected = selectedChips.has('flag')
  const hasContent = selectedChips.size > 0 || text.trim().length > 0

  function toggleChip(chipId, isFlag) {
    setSelectedChips(prev => {
      const next = new Set(prev)
      if (next.has(chipId)) {
        next.delete(chipId)
      } else {
        next.add(chipId)
        // Flag chip auto-enables warn toggle
        if (isFlag) setWarnNext(true)
      }
      return next
    })
  }

  async function handleSend() {
    if (!hasContent || sending) return
    setSending(true)
    try {
      const chips = CHIPS
        .filter(c => selectedChips.has(c.id) && !c.isFlag)
        .map(c => c.label)

      await writeNote({
        dogId: dog.id,
        dogName: dog.dog_name,
        dogSector: dog.sector || profile?.sector,
        walkerId: user?.id,
        walkerName: profile?.full_name || profile?.name || 'Walker',
        message: text,
        chips,
        warnNextWalker: warnNext,
        flag: isFlagSelected,
      })

      toast.success('Note sent ✓')
      onSent?.()
      onClose()
    } catch (err) {
      console.error('writeNote error:', err)
      toast.error('Something went wrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
          background: '#fff',
          borderRadius: '18px 18px 0 0',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.13)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 32, height: 3, borderRadius: 2, background: '#D5CFC8' }} />
        </div>

        {/* Title */}
        <div style={{
          padding: '4px 14px 10px',
          borderBottom: '1px solid #F0ECE8',
          fontSize: 14, fontWeight: 700, color: '#2D2926',
        }}>
          ✎ Note about {dog.dog_name}
        </div>

        <div style={{ padding: '12px 14px 0' }}>
          {/* Quick picks label */}
          <p style={{
            margin: '0 0 7px',
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: '#8C857E',
          }}>
            Quick picks
          </p>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {CHIPS.map(chip => {
              const selected = selectedChips.has(chip.id)
              const isFlag = chip.isFlag

              let bg, border, color
              if (selected && isFlag) {
                bg = '#FFF5F0'; border = '1.5px solid #E8634A'; color = '#E8634A'
              } else if (selected) {
                bg = '#EEEDFE'; border = '1.5px solid #534AB7'; color = '#534AB7'
              } else {
                bg = '#F0ECE8'; border = '1px solid #E8E4E0'; color = '#2D2926'
              }

              return (
                <button
                  key={chip.id}
                  onClick={() => toggleChip(chip.id, chip.isFlag)}
                  style={{
                    padding: '5px 10px', borderRadius: 20,
                    background: bg, border, color,
                    fontSize: 11, fontWeight: selected ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.12s',
                  }}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          {/* Free text */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add details... (optional)"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px', borderRadius: 8,
              background: '#FFF5F0', border: '1px solid #E8E4E0',
              fontSize: 12, color: '#2D2926', fontFamily: 'inherit',
              resize: 'none', minHeight: 60,
              outline: 'none',
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E8E4E0', margin: '12px 0 0' }} />

        {/* Warn next walker toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px 0',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#2D2926' }}>
              Warn next walker
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 9, color: '#8C857E' }}>
              Becomes an owl note — visible on card
            </p>
          </div>
          <button
            onClick={() => setWarnNext(v => !v)}
            style={{
              width: 44, height: 24, borderRadius: 12,
              background: warnNext ? '#C4851C' : '#E8E4E0',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: warnNext ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* Owl hint when toggle ON */}
        {warnNext && (
          <p style={{
            margin: '4px 14px 0',
            fontSize: 9, color: '#C4851C',
          }}>
            Will also appear as 🦉 owl note for 3 days
          </p>
        )}

        {/* Send button */}
        <div style={{ padding: '12px 14px 16px' }}>
          <button
            onClick={handleSend}
            disabled={!hasContent || sending}
            style={{
              width: '100%', padding: 11, borderRadius: 9,
              background: '#E8634A', color: '#fff',
              border: 'none', fontSize: 12, fontWeight: 700,
              cursor: hasContent && !sending ? 'pointer' : 'default',
              opacity: hasContent ? 1 : 0.5,
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
          >
            {sending ? 'Sending…' : 'Send note'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
