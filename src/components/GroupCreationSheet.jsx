import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

function nameToColor(name) {
  const colors = ['#7F77DD','#378ADD','#BA7517','#1D9E75','#D85A30','#5DCAA5','#534AB7','#993C1D'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function GroupCreationSheet({ isOpen, onClose, onCreateGroup, sector, walkDate }) {
  const [name, setName] = useState('')
  const [selectedWalkers, setSelectedWalkers] = useState([])
  const [walkers, setWalkers] = useState([])
  const inputRef = useRef(null)

  // Fetch walkers for this sector
  useEffect(() => {
    if (!isOpen) return
    setName('')
    setSelectedWalkers([])
    setTimeout(() => inputRef.current?.focus(), 300)

    async function fetchWalkers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, sector, schedule, photo_url')
        .or('role.eq.senior_walker,role.eq.junior_walker,role.eq.admin')
      if (!data) return

      const today = new Date(walkDate || Date.now())
        .toLocaleDateString('en-US', { weekday: 'short' }) // "Mon"

      const mapped = data
        .filter(p => p.sector === sector || !p.sector)
        .map(p => ({
          ...p,
          isWorkingToday: p.schedule?.includes(today) ?? false,
        }))
        .sort((a, b) => {
          // Working today first, then alphabetical
          if (a.isWorkingToday !== b.isWorkingToday) return b.isWorkingToday ? 1 : -1
          return (a.full_name || '').localeCompare(b.full_name || '')
        })

      setWalkers(mapped)
    }

    fetchWalkers()
  }, [isOpen, sector, walkDate])

  function toggleWalker(id) {
    setSelectedWalkers(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    )
  }

  function handleCreate() {
    onCreateGroup({ name: name.trim(), walkerIds: selectedWalkers })
    onClose()
  }

  if (!isOpen) return null

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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2 }} />
        </div>

        {/* Title */}
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1a1a1a' }}>New group</p>

        {/* Name input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name..."
          style={{
            width: '100%', padding: '10px 12px', border: '0.5px solid #ddd',
            borderRadius: 10, fontSize: 13, background: '#fafafa',
            marginBottom: 12, outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Walker section */}
        {walkers.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Who's walking today?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {walkers.map(w => {
                const selected = selectedWalkers.includes(w.id)
                const initial = w.full_name ? w.full_name.charAt(0).toUpperCase() : '?'
                const bgColor = nameToColor(w.full_name || '')
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWalker(w.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 10px', borderRadius: 8,
                      border: selected ? '2px solid #E8634A' : '0.5px solid #ddd',
                      background: selected ? '#FFF4F1' : 'transparent',
                      opacity: w.isWorkingToday ? 1 : 0.4,
                      cursor: 'pointer', fontSize: 11,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: w.photo_url ? '#f5f5f5' : bgColor,
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {w.photo_url ? (
                        <img src={w.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>{initial}</span>
                      )}
                    </div>
                    <span style={{ fontWeight: 500, color: '#1a1a1a' }}>
                      {w.full_name?.split(' ')[0]}
                      {!w.isWorkingToday && <span style={{ color: '#aaa', marginLeft: 3 }}>(off)</span>}
                    </span>
                    {selected && <span style={{ color: '#E8634A', fontWeight: 700, marginLeft: 2 }}>{'\u2713'}</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Create button */}
        <button
          onClick={handleCreate}
          style={{
            width: '100%', padding: 12, borderRadius: 10,
            background: '#E8634A', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            marginTop: 16,
          }}
        >
          Create group
        </button>
      </motion.div>
    </>
  )
}
