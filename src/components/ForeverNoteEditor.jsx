import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { assertFreshOrThrow, StaleBundleError } from '../lib/freshBundle'
import { useAuth } from '../context/AuthContext'

const EXAMPLE_PILLS = [
  'Reactive',
  'Dog reactive',
  'A humper!',
  'Sensitive soul',
  'Ring before going in',
  'Text Rodrigo 10 min before pickup',
]

export default function ForeverNoteEditor({ dog, currentNotes, onClose, onSaved }) {
  const { profile } = useAuth()
  const [text, setText] = useState(currentNotes || '')
  const [saving, setSaving] = useState(false)

  function insertPill(pill) {
    setText(prev => {
      const trimmed = prev.trimEnd()
      if (!trimmed) return pill
      return trimmed + ' ' + pill
    })
  }

  async function handleSave() {
    if (saving) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setSaving(true)
    const { error } = await supabase
      .from('dogs')
      .update({
        notes: text.trim() || null,
        updated_by: profile?.full_name || profile?.email || 'Unknown',
        updated_at: new Date().toISOString(),
      })
      .eq('id', dog.id)
    setSaving(false)
    if (error) {
      toast.error('Could not save — try again')
      return
    }
    toast.success('Forever note saved ★')
    onSaved(text.trim() || null)
    onClose()
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="forever-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Sheet */}
      <motion.div
        key="forever-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
          background: '#fdf4fb',
          borderRadius: '20px 20px 0 0',
          borderTop: '1.5px solid #961e78',
          boxShadow: '0 -4px 24px rgba(150,30,120,0.13)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <div style={{ width: 32, height: 3, borderRadius: 2, background: '#e8d0e3' }} />
        </div>

        <div style={{ padding: '0 14px 16px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#961e78' }}>
              ★ Forever Note — {dog.dog_name}
            </span>
            <span style={{
              background: '#961e78', color: '#fff',
              fontSize: 10, fontWeight: 600,
              borderRadius: 20, padding: '2px 8px',
            }}>
              Admin
            </span>
          </div>

          {/* Subheading */}
          <p style={{ fontSize: 10, color: '#B5AFA8', margin: '0 0 10px' }}>
            Only Rod and Gen can edit this
          </p>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a standing note..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px',
              background: '#fdf4fb',
              border: 'none',
              borderBottom: '1px solid #e8d0e3',
              borderRadius: 0,
              color: '#961e78',
              fontWeight: 500,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              resize: 'none',
              minHeight: 80,
              outline: 'none',
            }}
          />

          {/* Example pills */}
          <div style={{ marginTop: 10, marginBottom: 14 }}>
            <p style={{
              fontSize: 9, color: '#B5AFA8',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              fontWeight: 600, margin: '0 0 6px',
            }}>
              Real notes from your dogs
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
              {EXAMPLE_PILLS.map(pill => (
                <button
                  key={pill}
                  onClick={() => insertPill(pill)}
                  style={{
                    fontSize: 10,
                    border: '1px solid #e8d0e3',
                    background: '#fdf4fb',
                    color: '#961e78',
                    borderRadius: 20,
                    padding: '3px 9px',
                    margin: '0 4px 4px 0',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: '#FAF7F4',
                border: '1px solid #E8E4E0',
                color: '#8C857E',
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 2,
                background: saving ? '#c878b0' : '#961e78',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                cursor: saving ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {saving ? 'Saving…' : '★ Save forever note'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
