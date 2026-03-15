import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PhotoUpload from './PhotoUpload'

const EDIT_FIELDS = [
  { key: 'breed',     label: 'Breed' },
  { key: 'address',   label: 'Address' },
  { key: 'door_code', label: 'Door / Access Code' },
  { key: 'notes',     label: 'Notes', multiline: true },
  { key: 'bff',       label: 'Best Friends (BFF)' },
  { key: 'goals',     label: 'Goals', multiline: true },
]

function mapsUrl(address) {
  if (!address) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export default function DogProfileDrawer({ dog, onClose, onDogUpdated }) {
  const { canEdit, profile } = useAuth()
  const [doorRevealed, setDoorRevealed] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [photoPulse, setPhotoPulse] = useState(false)
  const scrollRef = useRef(null)

  /* eslint-disable react-hooks/set-state-in-effect -- reset local UI state when dog prop changes */
  useEffect(() => {
    setDoorRevealed(false)
    setImgError(false)
    setEditing(false)
    setSaveError(null)
    setPhotoPulse(false)
  }, [dog])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function startEdit() {
    setForm({
      breed:     dog.breed     || '',
      address:   dog.address   || '',
      door_code: dog.door_code || '',
      notes:     dog.notes     || '',
      bff:       dog.bff       || '',
      goals:     dog.goals     || '',
    })
    setEditing(true)
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const updates = {
      breed:      form.breed      || null,
      address:    form.address    || null,
      door_code:  form.door_code  || null,
      notes:      form.notes      || null,
      bff:        form.bff        || null,
      goals:      form.goals      || null,
      updated_at: new Date().toISOString(),
      updated_by: profile?.full_name || profile?.email || 'Unknown',
    }

    const { data, error } = await supabase
      .from('dogs')
      .update(updates)
      .eq('id', dog.id)
      .select()
      .single()

    setSaving(false)
    if (error) { setSaveError(error.message); return }
    toast.success('Profile updated')
    onDogUpdated?.(data)
    setEditing(false)
  }

  function handlePhotoUploaded(d) {
    setImgError(false)
    setPhotoPulse(true)
    setTimeout(() => setPhotoPulse(false), 800)
    onDogUpdated?.(d)
  }

  if (!dog) return null

  const photoUrl = dog.photo_url && !imgError ? dog.photo_url : null
  const directionsUrl = mapsUrl(dog.address)

  const updatedDate = dog.updated_at
    ? new Date(dog.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 500) onClose()
        }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Close + Edit buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="overflow-y-auto flex-1 px-5 pb-10 pt-2 scroll-container">

          {/* Centered photo + name */}
          <div className="flex flex-col items-center mb-6">
            <div className={`relative w-[120px] h-[120px] flex-shrink-0 ${photoPulse ? 'photo-pulse' : ''}`}>
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden bg-[#FFF4F1] flex items-center justify-center shadow-lg ring-4 ring-white">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={dog.dog_name}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-5xl">🐶</span>
                )}
              </div>
              {canEdit && dog.id && !editing && (
                <PhotoUpload dogId={dog.id} onUploaded={handlePhotoUploaded} />
              )}
            </div>

            <h2 className="text-xl font-bold text-[#1A1A1A] leading-tight mt-3">{dog.dog_name}</h2>
            {!editing && dog.breed && (
              <p className="text-[14px] text-[#888] mt-0.5">{dog.breed}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                dog.sector === 'Plateau'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-[#FDEBE7] text-[#E8634A]'
              }`}>
                {dog.sector}
              </span>
            </div>
          </div>

          {/* Edit mode */}
          {editing && (
            <div className="flex flex-col gap-3 mb-4">
              {EDIT_FIELDS.map(({ key, label, multiline }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1 block">{label}</label>
                  {multiline ? (
                    <textarea
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A] resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
                    />
                  )}
                </div>
              ))}
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setEditing(false); setSaveError(null) }}
                  className="flex-1 py-3 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-full bg-[#E8634A] text-white text-sm font-bold disabled:opacity-50 min-h-[48px] active:bg-[#d4552d]"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* View mode */}
          {!editing && (
            <div className="flex flex-col gap-3">

              {/* Notes alert */}
              {dog.notes && (
                <div className="bg-[#E8634A] text-white rounded-2xl px-4 py-3 flex gap-3 items-start max-h-[200px] overflow-y-auto scroll-container">
                  <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Notes</p>
                    <p className="text-sm font-medium leading-snug break-words">{dog.notes}</p>
                  </div>
                </div>
              )}

              {/* Door code — tap to reveal with flip */}
              {dog.door_code && (
                <div className="bg-gray-50 rounded-2xl p-4" style={{ perspective: '600px' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    <span className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide">Door / Access Code</span>
                  </div>
                  <AnimatePresence mode="wait">
                    {doorRevealed ? (
                      <motion.div
                        key="revealed"
                        initial={{ rotateX: -90, opacity: 0 }}
                        animate={{ rotateX: 0, opacity: 1 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center"
                      >
                        <p className="text-2xl font-mono font-bold text-[#1A1A1A] tracking-widest">{dog.door_code}</p>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="hidden"
                        exit={{ rotateX: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setDoorRevealed(true)}
                        className="w-full py-3 rounded-full bg-[#E8634A] text-white text-sm font-bold active:bg-[#d4552d] transition-colors min-h-[48px]"
                      >
                        Tap to reveal 🔑
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Address */}
              {dog.address && (
                <a
                  href={directionsUrl || '#'}
                  target={directionsUrl ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="bg-gray-50 rounded-2xl p-4 flex items-start gap-2 active:bg-gray-100 transition-colors"
                >
                  <span className="text-sm flex-shrink-0 mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-0.5">Address</p>
                    <p className="text-sm text-gray-700 leading-snug">{dog.address}</p>
                  </div>
                  {directionsUrl && (
                    <span className="flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-full active:bg-[#d4552d]">
                      Directions
                    </span>
                  )}
                </a>
              )}

              {/* Owner info */}
              {(dog.owner_first || dog.owner_last) && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-0.5">Owner</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {[dog.owner_first, dog.owner_last].filter(Boolean).join(' ')}
                      </p>
                      {dog.email && (
                        <a href={`mailto:${dog.email}`} className="text-sm text-[#E8634A] font-medium block mt-0.5">
                          {dog.email}
                        </a>
                      )}
                      {dog.phone && (
                        <a href={`tel:${dog.phone}`} className="text-sm text-[#E8634A] font-medium block mt-0.5">
                          {dog.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* BFF as pill badges */}
              {dog.bff && (
                <div className="bg-pink-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base flex-shrink-0">💕</span>
                    <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide">Best Friends</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dog.bff.split(/[,&]/).filter(s => s.trim()).map((name, i) => (
                      <span key={i} className="bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full">
                        {name.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals */}
              {dog.goals && (
                <div className="bg-green-50 rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">🎯</span>
                    <div>
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-0.5">Goals</p>
                      <p className="text-sm text-gray-700 leading-snug">{dog.goals}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Last updated footer */}
              {dog.updated_by && updatedDate && (
                <p className="text-xs text-gray-300 text-center mt-2">
                  Last updated by {dog.updated_by} on {updatedDate}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
