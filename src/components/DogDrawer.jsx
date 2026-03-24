import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PhotoUpload from './PhotoUpload'
import SmartTextInput from './SmartTextInput'
import SmartTextDisplay from './SmartTextDisplay'
import WalkerNotesSection from './WalkerNotesSection'
import { useAltAddress } from '../lib/useAltAddress'

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
  if (!address || !address.trim()) return null
  const trimmed = address.trim()
  const lower = trimmed.toLowerCase()
  const full = lower.includes('montréal') || lower.includes('montreal')
    ? `${trimmed}, Canada`
    : `${trimmed}, Montréal, QC, Canada`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(full)}`
}

const EDIT_FIELDS = [
  { key: 'breed',           label: 'Breed' },
  { key: 'address',         label: 'Address' },
  { key: 'building_access', label: '\u{1F3E2} Building Access' },
  { key: 'unit_number',     label: '\u{1F6AA} Unit Number' },
  { key: 'unit_access',     label: '\u{1F511} Unit Access' },
  { key: 'access_notes',    label: '\u{1F4DD} Access Notes' },
  { key: 'notes',           label: 'Notes', multiline: true, smart: true },
  { key: 'bff',             label: 'Best Friends (BFF)', smart: true },
  { key: 'goals',           label: 'Goals', multiline: true, smart: true },
]

// ── Friend check sub-component ──────────────────────────────────────
function FriendCheck({ dogName, dogId }) {
  const [open, setOpen] = useState(false)
  const [allDogs, setAllDogs] = useState([])
  const [searchName, setSearchName] = useState('')
  const [result, setResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [showExtra, setShowExtra] = useState(false)

  const options = useMemo(() => {
    if (!searchName) return allDogs.slice(0, 8)
    const q = searchName.toLowerCase()
    return allDogs
      .filter(d => d.dog_name.toLowerCase().includes(q) && d.id !== dogId)
      .sort((a, b) => {
        const aL = a.dog_name.toLowerCase()
        const bL = b.dog_name.toLowerCase()
        return (aL.startsWith(q) ? 0 : 1) - (bL.startsWith(q) ? 0 : 1)
      })
      .slice(0, 8)
  }, [searchName, allDogs, dogId])

  async function handleOpen() {
    setOpen(true)
    setResult(null)
    setSearchName('')
    setShowExtra(false)
    const { data } = await supabase.from('dogs').select('id, dog_name').order('dog_name')
    setAllDogs(data || [])
  }

  async function handleSearch(friendName, friendId) {
    if (!friendId) return
    setSearching(true)
    setResult(null)
    setShowExtra(false)

    const [{ data: logs1 }, { data: logs2 }] = await Promise.all([
      supabase.from('walk_logs').select('walk_date').eq('dog_id', dogId).order('walk_date', { ascending: false }),
      supabase.from('walk_logs').select('walk_date').eq('dog_id', friendId).order('walk_date', { ascending: false }),
    ])

    const dates1 = new Set((logs1 || []).map(l => l.walk_date))
    const dates2 = new Set((logs2 || []).map(l => l.walk_date))
    const sharedDates = [...dates1].filter(d => dates2.has(d)).sort().reverse()

    setResult({
      friendName,
      count: sharedDates.length,
      dates: sharedDates,
      first: sharedDates.length > 0 ? sharedDates[sharedDates.length - 1] : null,
      last: sharedDates.length > 0 ? sharedDates[0] : null,
    })
    setSearching(false)
    setSearchName('')
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="w-full py-3 rounded-full border-2 border-[#E8634A] text-[#E8634A] text-sm font-semibold active:bg-[#FFF4F1] transition-all min-h-[48px]"
      >
        🐾 Check for friends
      </button>
    )
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-2">Check for Friends</p>
      <div className="relative mb-2">
        <input
          type="text"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Which dog?"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
          autoFocus
        />
        {searchName && options.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
            {options.map(d => (
              <button
                key={d.id}
                onClick={() => handleSearch(d.dog_name, d.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#FFF4F1] transition-colors"
              >
                <span className="text-gray-400">🐕</span>
                <span className="text-gray-700 font-medium">{d.dog_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {searching && <p className="text-xs text-gray-400 text-center py-2">Searching...</p>}

      {result && (
        <div className="bg-white rounded-xl p-3 mt-2">
          <p className="text-sm font-semibold text-gray-800">
            {dogName} and {result.friendName} walked together{' '}
            <span className="text-[#E8634A]">{result.count} time{result.count !== 1 ? 's' : ''}</span>
          </p>
          {result.count > 0 && (
            <>
              <button
                onClick={() => setShowExtra(!showExtra)}
                className="text-xs text-gray-400 mt-1 active:text-gray-600"
              >
                Extra info {showExtra ? '▴' : '▾'}
              </button>
              {showExtra && (
                <div className="mt-2 text-xs text-gray-500">
                  <p>First: {new Date(result.first).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <p>Last: {new Date(result.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.dates.slice(0, 10).map(d => (
                      <span key={d} className="bg-gray-100 px-2 py-0.5 rounded-full">
                        {new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ))}
                    {result.dates.length > 10 && <span className="text-gray-400">+{result.dates.length - 10} more</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(false)}
        className="w-full mt-2 py-2 text-sm text-gray-400 active:text-gray-600"
      >
        Close
      </button>
    </div>
  )
}

export default function DogDrawer({ event, onClose, onDogUpdated, owlNotes, onAcknowledgeNote, onDogNameClick }) {
  const { isAdmin, permissions, profile } = useAuth()
  const canEdit = permissions.canEditDogProfiles
  const { todayAlt } = useAltAddress(event?.dog?.id)
  const [doorRevealed, setDoorRevealed] = useState(false)
  const [revealedSteps, setRevealedSteps] = useState({})
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
    setRevealedSteps({})
    setImgError(false)
    setEditing(false)
    setCreating(false)
    setSaveError(null)
    setPhotoPulse(false)
    setLinking(false)
    setLinkSearch('')
    if (event?.dog) {
      setForm({
        dog_name:        event.dog.dog_name        || '',
        breed:           event.dog.breed           || '',
        address:         event.dog.address         || '',
        building_access: event.dog.building_access || '',
        unit_number:     event.dog.unit_number     || '',
        unit_access:     event.dog.unit_access     || '',
        access_notes:    event.dog.access_notes    || '',
        notes:           event.dog.notes           || '',
        bff:             event.dog.bff             || '',
        goals:           event.dog.goals           || '',
        sector:          event.dog.sector || event.sector || 'Plateau',
        level:           event.dog.level           || 1,
        level_tags:      event.dog.level_tags      || [],
        level_tag_other: '',
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
      dog_name:        event.displayName       || '',
      address:         event.location          || '',
      building_access: event.calendarDoorCode  || '',
      unit_number:     '',
      unit_access:     '',
      access_notes:    '',
      notes:           '',
      sector: event.sector || 'Plateau',
    })
    setCreating(true)
    setEditing(true)
  }

  // Tag toggle helper
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

    if (creating) {
      const { data, error } = await supabase.from('dogs').insert([form]).select().single()
      setSaving(false)
      if (error) { setSaveError(error.message); return }
      toast.success('Dog profile created')
      onDogUpdated?.(data)
      setEditing(false)
      setCreating(false)
    } else {
      const { breed, address, building_access, unit_number, unit_access, access_notes, notes, bff, goals, level, level_tags } = form
      const { data, error } = await supabase
        .from('dogs')
        .update({
          breed: breed || null, address: address || null,
          building_access: building_access || null, unit_number: unit_number || null,
          unit_access: unit_access || null, access_notes: access_notes || null,
          notes: notes || null, bff: bff || null, goals: goals || null,
          level: level || 1,
          level_tags: (level_tags && level_tags.length > 0) ? level_tags : null,
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
  const defaultAddress = (editing ? form.address : (dog?.address || event.location || '')).trim()
  const address    = todayAlt?.address || defaultAddress
  const dogNotes   = editing ? form.notes : (dog?.notes || null)

  const accessSteps = []
  const bAccess = todayAlt?.door_code || dog?.building_access || event.calendarDoorCode || null
  const uNumber = dog?.unit_number || null
  const uAccess = dog?.unit_access || null
  const aNotes  = todayAlt?.access_notes || dog?.access_notes || null
  if (bAccess) accessSteps.push({ key: 'building', step: 1, emoji: '\u{1F3E2}', label: 'Building', value: bAccess })
  if (uNumber) accessSteps.push({ key: 'unit',     step: 2, emoji: '\u{1F6AA}', label: 'Unit',     value: uNumber })
  if (uAccess) accessSteps.push({ key: 'access',   step: 3, emoji: '\u{1F511}', label: 'Access',   value: uAccess })
  if (aNotes)  accessSteps.push({ key: 'notes',    step: 4, emoji: '\u{1F4DD}', label: 'Notes',    value: aNotes })
  const photoUrl   = dog?.photo_url && !imgError ? dog.photo_url : null
  const badge      = groupBadge(event._groupKey, event._groupName)
  const directionsUrl = mapsUrl(address)

  // Available tags based on level
  const availableTags = form.level === 3 ? LEVEL_3_TAGS : form.level === 2 ? LEVEL_2_TAGS : []

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
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200 z-10"
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
                {dog && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    dog.level === 3 ? 'bg-red-100 text-red-700' : dog.level === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      dog.level === 3 ? 'bg-red-500' : dog.level === 2 ? 'bg-yellow-400' : 'bg-green-500'
                    }`} />
                    {dog.level === 3 ? 'Extra Care' : dog.level === 2 ? 'Caution' : 'Chill'}
                  </span>
                )}
                {!editing && isAdmin && event.matchType === 'none' && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Unknown Explorer
                  </span>
                )}
                {!editing && !isAdmin && event.matchType === 'none' && (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-medium">
                    New
                  </span>
                )}
                {!editing && isAdmin && event.matchType === 'fuzzy' && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                    Fuzzy match
                  </span>
                )}
                {!editing && isAdmin && event.matchMethod && !['dog_name', 'name_map', 'none'].includes(event.matchMethod) && event.matchType !== 'fuzzy' && (
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

          {/* Level tags display (view mode) */}
          {!editing && dog && dog.level_tags && dog.level_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
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
              {/* Level selector */}
              {!creating && (
                <div>
                  <label className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1 block">Level</label>
                  <div className="flex gap-2">
                    {LEVEL_OPTIONS.map(({ value, label, color }) => (
                      <button
                        key={value}
                        onClick={() => setForm((f) => ({
                          ...f,
                          level: value,
                          // Clear tags if switching to level 1
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
                  {(form.level === 2 || form.level === 3) && (
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
                      {/* Custom tag input */}
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
                  )}
                </div>
              )}
              {EDIT_FIELDS.map(({ key, label, multiline, smart }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-1 block">{label}</label>
                  {smart && multiline ? (
                    <SmartTextInput
                      value={form[key] || ''}
                      onChange={(val) => setForm((f) => ({ ...f, [key]: val }))}
                      rows={2}
                      placeholder="Type @ to mention a dog..."
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
                      placeholder="Type @ to mention a dog..."
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

              {/* Owl notes */}
              {owlNotes && owlNotes.length > 0 && (
                <div className="flex flex-col gap-2">
                  {owlNotes.map((note) => (
                    <div key={note.id} className="bg-[#E8634A]/10 border border-[#E8634A]/30 rounded-2xl px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">{'\u{1F989}'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#E8634A] leading-snug">{note.note_text}</p>
                          {note.expires_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Daily reminder · Expires {new Date(note.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onAcknowledgeNote?.(note.id)}
                        className="mt-2 w-full py-2 rounded-full bg-[#E8634A] text-white text-sm font-bold"
                      >
                        Got it {'\u2713'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes alert */}
              {dogNotes && (
                <div className="bg-[#E8634A] text-white rounded-2xl px-4 py-3 flex gap-3 items-start max-h-[200px] overflow-y-auto scroll-container">
                  <span className="text-lg flex-shrink-0 mt-0.5">{'\u26A0\uFE0F'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Notes</p>
                    <SmartTextDisplay
                      text={dogNotes}
                      onDogClick={onDogNameClick}
                      className="text-sm font-medium leading-snug break-words"
                    />
                  </div>
                </div>
              )}

              {/* Access info */}
              {accessSteps.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-4" style={{ perspective: '600px' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    <span className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide">Access Info</span>
                  </div>
                  <AnimatePresence mode="wait">
                    {doorRevealed ? (
                      <motion.div
                        key="revealed"
                        initial={{ rotateX: -90, opacity: 0 }}
                        animate={{ rotateX: 0, opacity: 1 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="bg-white rounded-xl border border-gray-200 px-4 py-3"
                      >
                        <p className="text-base font-mono font-bold text-[#1A1A1A] tracking-wide">
                          🔑 {accessSteps.map((s) => s.value).join(' → ')}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="hidden"
                        exit={{ rotateX: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setDoorRevealed(true)}
                        className="w-full py-2.5 rounded-full bg-[#E8634A] text-white text-sm font-bold active:bg-[#d4552d] transition-colors min-h-[44px]"
                      >
                        Tap to reveal 🔑
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Address (uses today's alt address if available) */}
              {address && (
                <a
                  href={directionsUrl || '#'}
                  target={directionsUrl ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className={`rounded-2xl p-4 flex items-start gap-2 transition-colors ${
                    todayAlt ? 'bg-amber-50 border border-amber-200 active:bg-amber-100' : 'bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  <span className="text-sm flex-shrink-0 mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${todayAlt ? 'text-amber-700' : 'text-[#E8634A]'}`}>
                      {todayAlt ? `${todayAlt.day_of_week.charAt(0).toUpperCase() + todayAlt.day_of_week.slice(1)} address` : 'Address'}
                    </p>
                    <p className="text-sm text-gray-700 leading-snug">{address}</p>
                    {todayAlt?.door_code && <p className="text-xs text-amber-600 mt-0.5">Code: {todayAlt.door_code}</p>}
                    {todayAlt && defaultAddress && defaultAddress !== todayAlt.address && (
                      <p className="text-xs text-gray-400 mt-1">Default: {defaultAddress}</p>
                    )}
                  </div>
                  {directionsUrl && (
                    <span className={`flex-shrink-0 text-white text-xs font-semibold px-3 py-1.5 rounded-full ${todayAlt ? 'bg-amber-600' : 'bg-[#E8634A]'}`}>
                      Directions
                    </span>
                  )}
                </a>
              )}

              {/* Owner info — admin only */}
              {permissions.canViewClientInfo && (dog?.owner_first || dog?.owner_last || dog?.phone) && (
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

              {/* Contact & Instagram — admin only */}
              {permissions.canViewClientInfo && (dog?.contact_method || dog?.ig_handle) && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0 mt-0.5">📱</span>
                    <div>
                      <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-0.5">Contact</p>
                      {dog.contact_method && (
                        <p className="text-sm text-gray-700">{dog.contact_method}</p>
                      )}
                      {dog.ig_handle && (
                        <a
                          href={`https://instagram.com/${dog.ig_handle.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#E8634A] font-medium block mt-0.5"
                        >
                          @{dog.ig_handle.replace(/^@/, '')}
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
              {dog?.id && <WalkerNotesSection dogId={dog.id} />}

              {/* Acuity booking info (no profile) */}
              {!dog && (permissions.canViewClientInfo ? (event.email || event.ownerName) : false) && (
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

              {/* Check for Friends */}
              {dog?.id && (
                <FriendCheck dogName={dog.dog_name || event.displayName} dogId={dog.id} />
              )}

              {/* Last updated footer */}
              {dog?.updated_by && dog?.updated_at && (
                <p className="text-xs text-gray-300 text-center mt-2">
                  Last updated by {dog.updated_by} on {new Date(dog.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}

              {/* Actions */}
              {canEdit && (
                <div className="mt-1 flex flex-col gap-2">
                  {dog ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="w-full py-3 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold active:bg-gray-200 transition-all min-h-[48px]"
                    >
                      Edit Profile
                    </button>
                  ) : !isAdmin ? null : linking ? (
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
