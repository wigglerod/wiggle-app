import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Matches the color cycle in GroupOrganizer
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
  { key: 'address',   label: 'Address' },
  { key: 'door_info', label: 'Door Info / Code' },
  { key: 'must_know', label: 'Must Know', multiline: true },
  { key: 'extra_info', label: 'Extra Info', multiline: true },
]

export default function DogDrawer({ event, onClose, onDogUpdated }) {
  const { isAdmin } = useAuth()
  const [doorRevealed, setDoorRevealed] = useState(false)
  const [imgError, setImgError]         = useState(false)
  const [editing, setEditing]           = useState(false)
  const [creating, setCreating]         = useState(false)
  const [form, setForm]                 = useState({})
  const [saving, setSaving]             = useState(false)
  const [saveError, setSaveError]       = useState(null)

  useEffect(() => {
    setDoorRevealed(false)
    setImgError(false)
    setEditing(false)
    setCreating(false)
    setSaveError(null)
    if (event?.dog) {
      setForm({
        name:      event.dog.name      || '',
        address:   event.dog.address   || '',
        door_info: event.dog.door_info || '',
        must_know: event.dog.must_know || '',
        extra_info: event.dog.extra_info || '',
        sector:    event.dog.sector || event.sector || 'Plateau',
      })
    }
  }, [event])

  // Trap body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function startCreate() {
    setForm({
      name:      event.displayName       || '',
      address:   event.location          || '',
      door_info: event.calendarDoorCode  || '',
      must_know:  '',
      extra_info: '',
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
      onDogUpdated?.(data)
      setEditing(false)
      setCreating(false)
    } else {
      const { address, door_info, must_know, extra_info } = form
      const { data, error } = await supabase
        .from('dogs')
        .update({ address, door_info, must_know, extra_info })
        .eq('id', event.dog.id)
        .select()
        .single()
      setSaving(false)
      if (error) { setSaveError(error.message); return }
      onDogUpdated?.(data)
      setEditing(false)
    }
  }

  if (!event) return null

  const dog        = creating ? null : event.dog
  const address    = editing ? form.address : (dog?.address || event.location || '')
  const doorCode   = editing ? form.door_info : (dog?.door_info || event.calendarDoorCode || null)
  const mustKnow   = editing ? form.must_know  : (dog?.must_know  || null)
  const extraInfo  = editing ? form.extra_info : (dog?.extra_info  || null)
  const photoUrl   = dog?.photo_url && !imgError ? dog.photo_url : null
  const badge      = groupBadge(event._groupKey, event._groupName)
  const directionsUrl = mapsUrl(address)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-up sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-10 pt-2">

          {/* ── Header: photo + name + badges ── */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center flex-shrink-0 shadow-sm">
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

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#1A1A1A] leading-tight">{event.displayName}</h2>
              {event.breed && (
                <p className="text-sm text-gray-400 capitalize mt-0.5">{event.breed}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {/* Group badge */}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
                {/* Match badges */}
                {!editing && event.matchType === 'none' && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Profile Missing
                  </span>
                )}
                {!editing && event.matchType === 'fuzzy' && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                    Fuzzy match
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Edit mode ── */}
          {editing && (
            <div className="flex flex-col gap-3 mb-4">
              {creating && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                      Dog Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Sector</label>
                    <div className="flex gap-2">
                      {['Plateau', 'Laurier'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setForm((f) => ({ ...f, sector: s }))}
                          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
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
                  onClick={() => { setEditing(false); setCreating(false); setSaveError(null) }}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || (creating && !form.name?.trim())}
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

              {/* Must Know alert */}
              {mustKnow && (
                <div className="bg-[#E8634A] text-white rounded-2xl px-4 py-3 flex gap-3 items-start">
                  <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Must Know</p>
                    <p className="text-sm font-medium leading-snug">{mustKnow}</p>
                  </div>
                </div>
              )}

              {/* Door code — tap to reveal, then show large */}
              {doorCode && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Door / Access Code</span>
                  </div>
                  {doorRevealed ? (
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-2xl font-mono font-bold text-[#1A1A1A] tracking-widest">{doorCode}</p>
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
              {address && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      <p className="text-sm text-gray-700 leading-snug">{address}</p>
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

              {/* Notes */}
              {extraInfo && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Notes</p>
                      <p className="text-sm text-gray-700 leading-snug">{extraInfo}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency contact */}
              {(dog?.emergency_contact || dog?.emergency_phone) && (
                <div className="bg-red-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">Emergency Contact</p>
                  {dog.emergency_contact && (
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{dog.emergency_contact}</p>
                  )}
                  {dog.emergency_phone && (
                    <a
                      href={`tel:${dog.emergency_phone}`}
                      className="text-sm font-bold text-[#E8634A] active:opacity-70"
                    >
                      {dog.emergency_phone}
                    </a>
                  )}
                </div>
              )}

              {/* Calendar notes (no profile) */}
              {!dog && event.description && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Calendar Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-snug">{event.description}</p>
                </div>
              )}

              {/* Admin actions */}
              {isAdmin && (
                <div className="mt-1">
                  {dog ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold active:bg-gray-200 transition-all"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={startCreate}
                      className="w-full py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold active:bg-[#d4552d] transition-all"
                    >
                      + Create Dog Profile
                    </button>
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
