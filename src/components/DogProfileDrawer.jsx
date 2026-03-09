import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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

  useEffect(() => {
    setDoorRevealed(false)
    setImgError(false)
    setEditing(false)
    setSaveError(null)
  }, [dog])

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
    onDogUpdated?.(data)
    setEditing(false)
  }

  if (!dog) return null

  const photoUrl = dog.photo_url && !imgError ? dog.photo_url : null
  const directionsUrl = mapsUrl(dog.address)

  const updatedDate = dog.updated_at
    ? new Date(dog.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Close + Edit buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-10 pt-2">

          {/* Header: photo + name + badges */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative w-20 h-20 flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center shadow-sm">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={dog.dog_name}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-4xl">🐶</span>
                )}
              </div>
              {canEdit && dog.id && !editing && (
                <PhotoUpload dogId={dog.id} onUploaded={(d) => { setImgError(false); onDogUpdated?.(d) }} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#1A1A1A] leading-tight">{dog.dog_name}</h2>
              {!editing && dog.breed && (
                <p className="text-sm text-gray-400 mt-0.5">{dog.breed}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  dog.sector === 'Plateau'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {dog.sector}
                </span>
              </div>
            </div>
          </div>

          {/* ── Edit mode ── */}
          {editing && (
            <div className="flex flex-col gap-3 mb-4">
              {EDIT_FIELDS.map(({ key, label, multiline }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">{label}</label>
                  {multiline ? (
                    <textarea
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A] resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
                    />
                  )}
                </div>
              ))}
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setEditing(false); setSaveError(null) }}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* ── View mode ── */}
          {!editing && (
            <div className="flex flex-col gap-3">

              {/* Notes alert */}
              {dog.notes && (
                <div className="bg-[#E8634A] text-white rounded-2xl px-4 py-3 flex gap-3 items-start">
                  <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Notes</p>
                    <p className="text-sm font-medium leading-snug">{dog.notes}</p>
                  </div>
                </div>
              )}

              {/* Door code */}
              {dog.door_code && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Door / Access Code</span>
                  </div>
                  {doorRevealed ? (
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-2xl font-mono font-bold text-[#1A1A1A] tracking-widest">{dog.door_code}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDoorRevealed(true)}
                      className="w-full py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold active:bg-[#d4552d] transition-colors"
                    >
                      Tap to Reveal Code
                    </button>
                  )}
                </div>
              )}

              {/* Address */}
              {dog.address && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      <p className="text-sm text-gray-700 leading-snug">{dog.address}</p>
                    </div>
                    {directionsUrl && (
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-[#d4552d]"
                      >
                        Directions
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Owner info */}
              {(dog.owner_first || dog.owner_last) && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Owner</p>
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

              {/* BFF */}
              {dog.bff && (
                <div className="bg-pink-50 rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">💕</span>
                    <div>
                      <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide mb-0.5">Best Friends</p>
                      <p className="text-sm text-gray-700 leading-snug">{dog.bff}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Goals */}
              {dog.goals && (
                <div className="bg-green-50 rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">🎯</span>
                    <div>
                      <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-0.5">Goals</p>
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
