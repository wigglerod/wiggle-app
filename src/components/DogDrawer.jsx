import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PhotoUpload from './PhotoUpload'

const GROUP_COLORS = [
  { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  { bg: 'bg-green-100',  text: 'text-green-700'  },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  { bg: 'bg-rose-100',   text: 'text-rose-700'   },
  { bg: 'bg-teal-100',   text: 'text-teal-700'   },
]

function groupBadge(groupKey, groupName) {
  if (!groupKey || groupKey === 'unassigned') {
    return { label: 'Unassigned', bg: 'bg-gray-100', text: 'text-gray-500' }
  }
  const { bg, text } = GROUP_COLORS[(Number(groupKey) - 1) % GROUP_COLORS.length]
  return { label: groupName || `Group ${groupKey}`, bg, text }
}

function mapsUrl(address) {
  if (!address) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

const EDIT_FIELDS = [
  { key: 'breed',     label: 'Breed' },
  { key: 'address',   label: 'Address' },
  { key: 'door_code', label: 'Door / Access Code' },
  { key: 'notes',     label: 'Notes', multiline: true },
  { key: 'bff',       label: 'Best Friends (BFF)' },
  { key: 'goals',     label: 'Goals', multiline: true },
]

export default function DogDrawer({ event, onClose, onDogUpdated }) {
  const { canEdit, profile } = useAuth()
  const [doorRevealed, setDoorRevealed] = useState(false)
  const [imgError, setImgError]         = useState(false)
  const [editing, setEditing]           = useState(false)
  const [creating, setCreating]         = useState(false)
  const [form, setForm]                 = useState({})
  const [saving, setSaving]             = useState(false)
  const [saveError, setSaveError]       = useState(null)
  const [photoPulse, setPhotoPulse]     = useState(false)
  const [linking, setLinking]           = useState(false)
  const [linkSearch, setLinkSearch]     = useState('')
  const [allDogs, setAllDogs]           = useState([])
  const [linkSaving, setLinkSaving]     = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- reset local UI state when event prop changes */
  useEffect(() => {
    setDoorRevealed(false)
    setImgError(false)
    setEditing(false)
    setCreating(false)
    setSaveError(null)
    setPhotoPulse(false)
    setLinking(false)
    setLinkSearch('')
    if (event?.dog) {
      setForm({
        dog_name:  event.dog.dog_name  || '',
        breed:     event.dog.breed     || '',
        address:   event.dog.address   || '',
        door_code: event.dog.door_code || '',
        notes:     event.dog.notes     || '',
        bff:       event.dog.bff       || '',
        goals:     event.dog.goals     || '',
        sector:    event.dog.sector || event.sector || 'Plateau',
      })
    }
  }, [event])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function startCreate() {
    setForm({
      dog_name:  event.displayName       || '',
      address:   event.location          || '',
      door_code: event.calendarDoorCode  || '',
      notes:     '',
      sector: event.sector || 'Plateau',
    })
    setCreating(true)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    if (creating) {
      const { data, error } = await supabase.from('dogs').insert([form]).select().single()
      setSaving(false)
      if (error) { setSaveError(error.message); return }
      toast.success('Dog profile created')
      onDogUpdated?.(data)
      setEditing(false)
      setCreating(false)
    } else {
      const { breed, address, door_code, notes, bff, goals } = form
      const { data, error } = await supabase
        .from('dogs')
        .update({
          breed: breed || null, address: address || null, door_code: door_code || null,
          notes: notes || null, bff: bff || null, goals: goals || null,
          updated_at: new Date().toISOString(),
          updated_by: profile?.full_name || profile?.email || 'Unknown',
        })
        .eq('id', event.dog.id)
        .select()
        .single()
      setSaving(false)
      if (error) { setSaveError(error.message); return }
      toast.success('Profile updated')
      onDogUpdated?.(data)
      setEditing(false)
    }
  }

  function handlePhotoUploaded(d) {
    setImgError(false)
    setPhotoPulse(true)
    setTimeout(() => setPhotoPulse(false), 800)
    onDogUpdated?.(d)
  }

  async function startLink() {
    setLinking(true)
    setLinkSearch('')
    const { data } = await supabase.from('dogs').select('id, dog_name, sector').order('dog_name')
    setAllDogs(data || [])
  }

  async function handleLink(dog) {
    setLinkSaving(true)
    const acuityName = event.displayName || event.summary?.trim().split(/\s+/)[0] || ''
    const { error } = await supabase.from('acuity_name_map').upsert(
      { acuity_name: acuityName, dog_name: dog.dog_name, acuity_email: '' },
      { onConflict: 'acuity_name,acuity_email' }
    )
    setLinkSaving(false)
    if (error) {
      toast.error('Failed to save mapping')
      return
    }
    toast.success(`Linked "${acuityName}" → ${dog.dog_name}`)
    onDogUpdated?.(dog)
    setLinking(false)
  }

  if (!event) return null

  const dog        = creating ? null : event.dog
  const address    = editing ? form.address : (dog?.address || event.location || '')
  const doorCode   = editing ? form.door_code : (dog?.door_code || event.calendarDoorCode || null)
  const dogNotes   = editing ? form.notes : (dog?.notes || null)
  const photoUrl   = dog?.photo_url && !imgError ? dog.photo_url : null
  const badge      = groupBadge(event._groupKey, event._groupName)
  const directionsUrl = mapsUrl(address)

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

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200 z-10 min-h-[36px]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="overflow-y-auto flex-1 px-5 pb-10 pt-2 scroll-container">

          {/* Header: photo + name + badges */}
          <div className="flex items-center gap-4 mb-5">
            <div className={`relative w-20 h-20 flex-shrink-0 ${photoPulse ? 'photo-pulse' : ''}`}>
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center shadow-sm">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={event.displayName}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-4xl">🐶</span>
                )}
              </div>
              {canEdit && dog?.id && !editing && (
                <PhotoUpload dogId={dog.id} onUploaded={handlePhotoUploaded} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#1A1A1A] leading-tight">{event.displayName}</h2>
              {(event.breed || dog?.breed) && (
                <p className="text-[14px] text-[#888] capitalize mt-0.5">{dog?.breed || event.breed}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
                {!editing && event.matchType === 'none' && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Unknown Explorer
                  </span>
                )}
                {!editing && event.matchType === 'fuzzy' && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                    Fuzzy match
                  </span>
                )}
                {!editing && event.matchMethod && !['dog_name', 'name_map', 'none'].includes(event.matchMethod) && event.matchType !== 'fuzzy' && (
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
                    {event.matchMethod === 'email' ? 'Email match' :
                     event.matchMethod === 'email_household' ? 'Household' :
                     event.matchMethod === 'owner_last_name' ? 'Owner match' :
                     event.matchMethod === 'phone' ? 'Phone match' : event.matchMethod}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Edit mode */}
          {editing && (
            <div className="flex flex-col gap-3 mb-4">
              {creating && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1 block">
                      Dog Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.dog_name}
                      onChange={(e) => setForm((f) => ({ ...f, dog_name: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1 block">Sector</label>
                    <div className="flex gap-2">
                      {['Plateau', 'Laurier'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setForm((f) => ({ ...f, sector: s }))}
                          className={`flex-1 py-2.5 rounded-full text-sm font-semibold border transition-all min-h-[44px] ${
                            form.sector === s
                              ? 'bg-[#E8634A] text-white border-[#E8634A]'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
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
                  onClick={() => { setEditing(false); setCreating(false); setSaveError(null) }}
                  className="flex-1 py-3 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || (creating && !form.dog_name?.trim())}
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
              {dogNotes && (
                <div className="bg-[#E8634A] text-white rounded-2xl px-4 py-3 flex gap-3 items-start max-h-[200px] overflow-y-auto scroll-container">
                  <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Notes</p>
                    <p className="text-sm font-medium leading-snug break-words">{dogNotes}</p>
                  </div>
                </div>
              )}

              {/* Door code — tap to reveal with flip */}
              {doorCode && (
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
                        <p className="text-2xl font-mono font-bold text-[#1A1A1A] tracking-widest">{doorCode}</p>
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
              {address && (
                <a
                  href={directionsUrl || '#'}
                  target={directionsUrl ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="bg-gray-50 rounded-2xl p-4 flex items-start gap-2 active:bg-gray-100 transition-colors"
                >
                  <span className="text-sm flex-shrink-0 mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-0.5">Address</p>
                    <p className="text-sm text-gray-700 leading-snug">{address}</p>
                  </div>
                  {directionsUrl && (
                    <span className="flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                      Directions
                    </span>
                  )}
                </a>
              )}

              {/* Owner info */}
              {(dog?.owner_first || dog?.owner_last || dog?.phone) && (
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
              {dog?.bff && (
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
              {dog?.goals && (
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

              {/* Acuity booking info (no profile) */}
              {!dog && (event.email || event.ownerName) && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1">Booking Info</p>
                  {event.ownerName && <p className="text-sm text-gray-700">{event.ownerName}</p>}
                  {event.email && <p className="text-sm text-gray-500">{event.email}</p>}
                  {event.phone && <p className="text-sm text-gray-500">{event.phone}</p>}
                </div>
              )}

              {/* Calendar notes (no profile) */}
              {!dog && event.description && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1">Calendar Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-snug">{event.description}</p>
                </div>
              )}

              {/* Last updated footer */}
              {dog?.updated_by && dog?.updated_at && (
                <p className="text-xs text-gray-300 text-center mt-2">
                  Last updated by {dog.updated_by} on {new Date(dog.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}

              {/* Admin actions */}
              {canEdit && (
                <div className="mt-1 flex flex-col gap-2">
                  {dog ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="w-full py-3 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold active:bg-gray-200 transition-all min-h-[48px]"
                    >
                      Edit Profile
                    </button>
                  ) : linking ? (
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-2">Link to Existing Dog</p>
                      <input
                        type="text"
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                        placeholder="Search dogs..."
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                        {allDogs
                          .filter((d) => !linkSearch || d.dog_name.toLowerCase().includes(linkSearch.toLowerCase()))
                          .map((d) => (
                            <button
                              key={d.id}
                              onClick={() => handleLink(d)}
                              disabled={linkSaving}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#FFF4F1] active:bg-[#FDEBE7] transition-colors flex items-center justify-between"
                            >
                              <span className="font-medium text-gray-700">{d.dog_name}</span>
                              {d.sector && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  d.sector === 'Plateau' ? 'bg-blue-100 text-blue-700' : 'bg-[#FDEBE7] text-[#E8634A]'
                                }`}>{d.sector}</span>
                              )}
                            </button>
                          ))}
                      </div>
                      <button
                        onClick={() => setLinking(false)}
                        className="w-full mt-2 py-2 text-sm text-gray-400 active:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={startLink}
                        className="w-full py-3 rounded-full bg-[#E8634A] text-white text-sm font-bold active:bg-[#d4552d] transition-all min-h-[48px]"
                      >
                        🔗 Link to Existing Dog
                      </button>
                      <button
                        onClick={startCreate}
                        className="w-full py-3 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold active:bg-gray-200 transition-all min-h-[48px]"
                      >
                        + Create New Profile
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
