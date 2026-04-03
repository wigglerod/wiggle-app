import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PhotoUpload from './PhotoUpload'
import SmartTextInput from './SmartTextInput'
import SmartTextDisplay from './SmartTextDisplay'
import WalkerNotesSection from './WalkerNotesSection'
import { useAltAddress, getTodayDayName } from '../lib/useAltAddress'
import { useOwlNotes } from '../lib/useOwlNotes'

const EDIT_FIELDS = [
  { key: 'breed',     label: 'Breed' },
  { key: 'address',   label: 'Address' },
  { key: 'door_code', label: 'Door / Access Code' },
  { key: 'notes',     label: 'Notes', multiline: true, smart: true },
  { key: 'bff',       label: 'Best Friends (BFF)', smart: true },
  { key: 'goals',     label: 'Goals', multiline: true, smart: true },
]

const LEVEL_OPTIONS = [
  { value: 1, label: 'Level 1 — Chill', color: 'bg-green-500' },
  { value: 2, label: 'Level 2 — Caution', color: 'bg-yellow-400' },
  { value: 3, label: 'Level 3 — Extra Care', color: 'bg-red-500' },
]

const LEVEL_2_TAGS = [
  'Resource guarding', 'Eats everything', 'Leash reactive', 'Shy/fearful',
  'Pulls hard', 'Medication needed', 'Food allergies', 'Selective with dogs',
]
const LEVEL_3_TAGS = [
  ...LEVEL_2_TAGS,
  'Can be aggressive', 'Bite history', 'Not safe with puppies',
  'Muzzle required', 'Experienced walker only',
]

function mapsUrl(address) {
  if (!address) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export default function DogProfileDrawer({ dog, onClose, onDogUpdated, onDogNameClick }) {
  const { permissions, profile } = useAuth()
  const canEdit = permissions.canEditDogProfiles

  // Owl notes — hook self-manages sector filtering via useAuth internally
  const { dogNotes, acknowledgeNote } = useOwlNotes()
  const activeOwlNotes = dog ? dogNotes(dog.id) : []

  function timeAgo(isoString) {
    if (!isoString) return ''
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  function daysUntilExpiry(isoString) {
    if (!isoString) return null
    const diff = new Date(isoString).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }
  const [imgError, setImgError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const scrollRef = useRef(null)

  // Alt addresses
  const { altAddresses, todayAlt, refetch: refetchAlt } = useAltAddress(dog?.id)
  const [showAltForm, setShowAltForm] = useState(false)
  const [altForm, setAltForm] = useState({ day_of_week: '', address: '', door_code: '', access_notes: '' })
  const [altSaving, setAltSaving] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- reset local UI state when dog prop changes */
  useEffect(() => {
    setImgError(false)
    setEditing(false)
    setSaveError(null)
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
      level:     dog.level     || 1,
      level_tags: dog.level_tags || [],
      level_tag_other: '',
    })
    setEditing(true)
    setSaveError(null)
  }

  function toggleTag(tag) {
    setForm(f => {
      const tags = f.level_tags || []
      return {
        ...f,
        level_tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
      }
    })
  }

  function addCustomTag() {
    const tag = (form.level_tag_other || '').trim()
    if (!tag) return
    setForm(f => ({
      ...f,
      level_tags: [...(f.level_tags || []), tag],
      level_tag_other: '',
    }))
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
      level:      form.level      || 1,
      level_tags: (form.level_tags && form.level_tags.length > 0) ? form.level_tags : null,
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
    onDogUpdated?.(d)
  }

  async function saveAltAddress() {
    if (!altForm.day_of_week || !altForm.address.trim()) return
    setAltSaving(true)
    const { error } = await supabase.from('dog_alt_addresses').insert({
      dog_id: dog.id,
      dog_name: dog.dog_name,
      day_of_week: altForm.day_of_week,
      address: altForm.address.trim(),
      door_code: altForm.door_code.trim() || null,
      access_notes: altForm.access_notes.trim() || null,
    })
    setAltSaving(false)
    if (!error) {
      setShowAltForm(false)
      setAltForm({ day_of_week: '', address: '', door_code: '', access_notes: '' })
      refetchAlt()
    }
  }

  async function deleteAltAddress(id) {
    await supabase.from('dog_alt_addresses').delete().eq('id', id)
    refetchAlt()
  }

  if (!dog) return null

  const todayAddress = todayAlt?.address || dog.address
  const photoUrl = dog.photo_url && !imgError ? dog.photo_url : null
  const directionsUrl = mapsUrl(todayAddress)

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
            <div className="relative w-[120px] h-[120px] flex-shrink-0">
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
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FDEBE7] text-[#E8634A]">
                {dog.sector}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                dog.level === 3 ? 'bg-red-100 text-red-700' : dog.level === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  dog.level === 3 ? 'bg-red-500' : dog.level === 2 ? 'bg-yellow-400' : 'bg-green-500'
                }`} />
                {dog.level === 3 ? 'Extra Care' : dog.level === 2 ? 'Caution' : 'Chill'}
              </span>
            </div>
          </div>

          {/* Level tags display (view mode) */}
          {!editing && dog.level_tags && dog.level_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mb-4">
              {dog.level_tags.map(tag => (
                <span
                  key={tag}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    dog.level === 3 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Edit mode */}
          {editing && (
            <div className="flex flex-col gap-3 mb-4">
              {/* Level selector */}
              <div>
                <label className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1 block">Level</label>
                <div className="flex gap-2">
                  {LEVEL_OPTIONS.map(({ value, label, color }) => (
                    <button
                      key={value}
                      onClick={() => setForm((f) => ({
                        ...f,
                        level: value,
                        level_tags: value === 1 ? [] : f.level_tags,
                      }))}
                      className={`flex-1 py-2.5 rounded-full text-xs font-semibold border transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
                        form.level === value
                          ? 'bg-[#E8634A] text-white border-[#E8634A]'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${form.level === value ? 'bg-white' : color}`} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Level tags grid */}
                {(form.level === 2 || form.level === 3) && (() => {
                  const availableTags = form.level === 3 ? LEVEL_3_TAGS : LEVEL_2_TAGS
                  return (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Why this level?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`text-xs px-2.5 py-1.5 rounded-full font-medium border transition-all ${
                              (form.level_tags || []).includes(tag)
                                ? 'bg-[#E8634A] text-white border-[#E8634A]'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={form.level_tag_other || ''}
                          onChange={(e) => setForm(f => ({ ...f, level_tag_other: e.target.value }))}
                          placeholder="Other..."
                          className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#E8634A]"
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                        />
                        <button
                          onClick={addCustomTag}
                          disabled={!(form.level_tag_other || '').trim()}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold disabled:opacity-40"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
              {EDIT_FIELDS.map(({ key, label, multiline, smart }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1 block">{label}</label>
                  {smart && multiline ? (
                    <SmartTextInput
                      value={form[key] || ''}
                      onChange={(val) => setForm((f) => ({ ...f, [key]: val }))}
                      rows={2}
                      placeholder={`Type @ to mention a dog...`}
                    />
                  ) : multiline ? (
                    <textarea
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A] resize-none"
                    />
                  ) : smart ? (
                    <SmartTextInput
                      value={form[key] || ''}
                      onChange={(val) => setForm((f) => ({ ...f, [key]: val }))}
                      rows={1}
                      placeholder={`Type @ to mention a dog...`}
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

              {/* Forever notes alert */}
              {dog.notes && (
                <div className="bg-[#E8634A] text-white rounded-2xl px-4 py-3 flex gap-3 items-start max-h-[200px] overflow-y-auto scroll-container">
                  <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Notes</p>
                    <SmartTextDisplay
                      text={dog.notes}
                      onDogClick={onDogNameClick}
                      className="text-sm font-medium leading-snug break-words"
                    />
                  </div>
                </div>
              )}

              {/* 🦉 Owl Notes — sector-filtered, timed, per-walker acknowledgement */}
              {activeOwlNotes.length > 0 && (
                <div style={{ background: '#FFFBF0', borderRadius: 16, border: '1px solid #F0C76E', padding: '10px 14px' }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: '#C4851C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    🦉 Owl Notes
                  </p>
                  {activeOwlNotes.map((note, idx) => {
                    const days = daysUntilExpiry(note.expires_at)
                    const expiryColor = days !== null && days < 2 ? '#E8634A' : '#8C857E'
                    return (
                      <div key={note.id}>
                        {idx > 0 && <div style={{ height: 1, background: '#F0C76E', margin: '10px 0' }} />}
                        <p style={{ fontSize: 11, color: '#2D2926', lineHeight: 1.45, marginBottom: 4 }}>
                          {note.note_text}
                        </p>
                        <p style={{ fontSize: 9, color: '#8C857E', marginBottom: 8 }}>
                          {note.created_by_name || 'Unknown'}
                          {' · '}{timeAgo(note.created_at)}
                          {days !== null && (
                            <> · <span style={{ color: expiryColor }}>expires {days}d</span></>
                          )}
                        </p>
                        <button
                          onClick={() => acknowledgeNote(note.id)}
                          style={{
                            width: '100%',
                            minHeight: 44,
                            background: '#2D8F6F',
                            color: '#fff',
                            fontFamily: 'inherit',
                            fontSize: 12,
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: 9,
                            cursor: 'pointer',
                          }}
                        >
                          Got it
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Door code — plain slate pill */}
              {dog.door_code && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    <span className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide">Door / Access Code</span>
                  </div>
                  <span className="inline-block bg-slate-600 text-white text-lg font-mono font-bold px-4 py-1.5 rounded-full tracking-widest">
                    #{dog.door_code}
                  </span>
                </div>
              )}

              {/* Today's alt address */}
              {todayAlt && (
                <a
                  href={mapsUrl(todayAlt.address) || '#'}
                  target={mapsUrl(todayAlt.address) ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="bg-amber-50 rounded-2xl p-4 flex items-start gap-2 border border-amber-200 active:bg-amber-100 transition-colors"
                >
                  <span className="text-sm flex-shrink-0 mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
                      {todayAlt.day_of_week.charAt(0).toUpperCase() + todayAlt.day_of_week.slice(1)} address
                    </p>
                    <p className="text-sm text-gray-800 font-semibold leading-snug">{todayAlt.address}</p>
                    {todayAlt.door_code && <p className="text-xs text-amber-600 mt-0.5">Code: {todayAlt.door_code}</p>}
                    {todayAlt.access_notes && <p className="text-xs text-gray-500 mt-0.5">{todayAlt.access_notes}</p>}
                  </div>
                  {mapsUrl(todayAlt.address) && (
                    <span className="flex-shrink-0 bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                      Directions
                    </span>
                  )}
                </a>
              )}

              {/* Default address */}
              {dog.address && (
                <a
                  href={!todayAlt ? (directionsUrl || '#') : '#'}
                  target={!todayAlt && directionsUrl ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className={`rounded-2xl p-4 flex items-start gap-2 transition-colors ${
                    todayAlt ? 'bg-gray-50/60' : 'bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  <span className="text-sm flex-shrink-0 mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-0.5">
                      {todayAlt ? 'Default Address' : 'Address'}
                    </p>
                    <p className={`text-sm leading-snug ${todayAlt ? 'text-gray-400' : 'text-gray-700'}`}>{dog.address}</p>
                  </div>
                  {!todayAlt && directionsUrl && (
                    <span className="flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-full active:bg-[#d4552d]">
                      Directions
                    </span>
                  )}
                </a>
              )}

              {/* Alternate addresses — admin only */}
              {canEdit && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide flex items-center gap-1">
                      📍 Alternate Addresses
                    </p>
                    {!showAltForm && (
                      <button
                        onClick={() => setShowAltForm(true)}
                        className="text-xs text-[#E8634A] font-semibold active:opacity-60"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  {altAddresses.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-2">
                      {altAddresses.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm">
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-gray-700 capitalize">{a.day_of_week}</span>
                            <span className="text-gray-400 mx-1">·</span>
                            <span className="text-gray-600 truncate">{a.address}</span>
                            {a.door_code && <span className="text-gray-400 ml-1">({a.door_code})</span>}
                          </div>
                          <button
                            onClick={() => deleteAltAddress(a.id)}
                            className="text-gray-300 active:text-red-500 ml-2 text-xs min-w-[24px] min-h-[24px] flex items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {altAddresses.length === 0 && !showAltForm && (
                    <p className="text-xs text-gray-400 italic">No alternate addresses set</p>
                  )}

                  {showAltForm && (
                    <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                      <select
                        value={altForm.day_of_week}
                        onChange={e => setAltForm(f => ({ ...f, day_of_week: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select day...</option>
                        {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Address"
                        value={altForm.address}
                        onChange={e => setAltForm(f => ({ ...f, address: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Door code (optional)"
                        value={altForm.door_code}
                        onChange={e => setAltForm(f => ({ ...f, door_code: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Access notes (optional)"
                        value={altForm.access_notes}
                        onChange={e => setAltForm(f => ({ ...f, access_notes: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAltForm(false)}
                          className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveAltAddress}
                          disabled={altSaving || !altForm.day_of_week || !altForm.address.trim()}
                          className="flex-1 py-2 rounded-lg bg-[#E8634A] text-white text-sm font-bold disabled:opacity-40"
                        >
                          {altSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Owner info — admin only */}
              {permissions.canViewClientInfo && (dog.owner_first || dog.owner_last) && (
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
                      <SmartTextDisplay
                        text={dog.goals}
                        onDogClick={onDogNameClick}
                        className="text-sm text-gray-700 leading-snug"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Walker notes */}
              <WalkerNotesSection dogId={dog.id} />

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
