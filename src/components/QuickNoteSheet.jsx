import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

function nameToColor(name) {
  const colors = ['#7F77DD','#378ADD','#BA7517','#1D9E75','#D85A30','#5DCAA5','#534AB7','#993C1D'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const TAGS = [
  { label: 'Sooo happyy',           bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  { label: 'Great walk!',           bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  { label: 'Soft stool / diarrhea', bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  { label: 'Wounded',               bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  { label: 'Refuse to walk',        bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  { label: 'Limping',               bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  { label: 'Reactive',              bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  { label: 'Seems off',             bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  { label: 'DM Me',                 bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
]

export default function QuickNoteSheet({ isOpen, onClose, dog, groupName, walkDate, walkerId, walkerName }) {
  const [selectedTags, setSelectedTags] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedTags([])
      setMessage('')
      setSaving(false)
    }
  }, [isOpen])

  function toggleTag(label) {
    setSelectedTags(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    )
  }

  async function handleSave() {
    if (selectedTags.length === 0 && !message.trim()) return
    setSaving(true)

    const { data, error } = await supabase.from('walker_notes').insert({
      dog_id: dog.id,
      dog_name: dog.dog_name,
      walker_id: walkerId,
      walker_name: walkerName,
      tags: selectedTags.length > 0 ? selectedTags : null,
      message: message.trim() || null,
      walk_date: walkDate,
      note_type: 'note',
    }).select().single()

    setSaving(false)

    if (error) {
      toast.error('Failed to save note')
    } else {
      if (navigator.vibrate) navigator.vibrate(50)
      toast('Note saved', {
        action: {
          label: 'Undo',
          onClick: async () => {
            if (data?.id) {
              await supabase.from('walker_notes').delete().eq('id', data.id)
              toast('Note removed')
            }
          },
        },
        duration: 5000,
      })
      onClose()
    }
  }

  if (!isOpen || !dog) return null

  const photoUrl = dog.photo_url || null
  const initial = dog.dog_name ? dog.dog_name.charAt(0).toUpperCase() : '?'
  const bgColor = nameToColor(dog.dog_name || '')

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="fixed bottom-0 left-0 right-0 z-[101] bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ borderRadius: '16px 16px 0 0', padding: 16 }}
      >
        {/* Pull handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2 }} />
        </div>

        {/* Dog header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {/* Dog photo */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: photoUrl ? '#f5f5f5' : bgColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {photoUrl ? (
              <img src={photoUrl} alt={dog.dog_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{initial}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{dog.dog_name}</div>
            {groupName && (
              <div style={{ fontSize: 11, color: '#aaa' }}>{groupName}</div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {TAGS.map(({ label, bg, border, text }) => {
            const active = selectedTags.includes(label)
            return (
              <button
                key={label}
                onClick={() => toggleTag(label)}
                style={{
                  minHeight: 44,
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 12px',
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: bg, color: text,
                  border: active ? `2px solid ${text}` : `0.5px solid ${border}`,
                  cursor: 'pointer',
                  transition: 'border 0.15s',
                }}
              >
                {active && <span style={{ fontWeight: 700 }}>{'\u2713'}</span>}
                {label}
              </button>
            )
          })}
        </div>

        {/* Custom text input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a note..."
          style={{
            width: '100%', padding: 10, border: '0.5px solid #ddd',
            borderRadius: 8, fontSize: 12, outline: 'none',
            marginBottom: 10, boxSizing: 'border-box',
          }}
        />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || (selectedTags.length === 0 && !message.trim())}
          style={{
            width: '100%', padding: 12, borderRadius: 10,
            background: '#E8634A', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            opacity: saving || (selectedTags.length === 0 && !message.trim()) ? 0.4 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save note'}
        </button>
      </motion.div>
    </>
  )
}
