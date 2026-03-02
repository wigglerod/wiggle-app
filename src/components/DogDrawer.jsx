import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function getMapsLinks(address) {
  if (!address) return null
  const encoded = encodeURIComponent(address)
  return {
    apple: `https://maps.apple.com/?q=${encoded}`,
    google: `https://maps.google.com/?q=${encoded}`,
  }
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

const EDIT_FIELDS = [
  { key: 'address', label: 'Address' },
  { key: 'door_info', label: 'Door Info / Code' },
  { key: 'must_know', label: 'Must Know', multiline: true },
  { key: 'extra_info', label: 'Extra Info', multiline: true },
]

export default function DogDrawer({ event, onClose, onDogUpdated }) {
  const { isAdmin } = useAuth()
  const [doorRevealed, setDoorRevealed] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Reset state when event changes
  useEffect(() => {
    setDoorRevealed(false)
    setImgError(false)
    setEditing(false)
    setCreating(false)
    setSaveError(null)
    if (event?.dog) {
      setForm({
        name: event.dog.name || '',
        address: event.dog.address || '',
        door_info: event.dog.door_info || '',
        must_know: event.dog.must_know || '',
        extra_info: event.dog.extra_info || '',
        sector: event.dog.sector || event.sector || 'Plateau',
      })
    }
  }, [event])

  // Trap scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function startCreate() {
    setForm({
      name: event.displayName || '',
      address: event.location || '',
      door_info: event.calendarDoorCode || '',
      must_know: '',
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
      // Create new dog profile
      const { data, error } = await supabase
        .from('dogs')
        .insert([form])
        .select()
        .single()

      setSaving(false)
      if (error) { setSaveError(error.message); return }
      onDogUpdated?.(data)
      setEditing(false)
      setCreating(false)
    } else {
      // Update existing dog
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

  const dog = creating ? null : event.dog
  const address = editing ? form.address : (event.location || dog?.address || '')
  const maps = getMapsLinks(address)
  const mapsUrl = isIOS() ? maps?.apple : maps?.google
  const doorCode = editing ? form.door_info : (event.calendarDoorCode || dog?.door_info || null)
  const mustKnow = editing ? form.must_know : (dog?.must_know || null)
  const extraInfo = editing ? form.extra_info : (dog?.extra_info || null)
  const photoUrl = dog?.photo_url && !imgError ? dog.photo_url : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg font-medium active:bg-gray-200"
        >
          x
        </button>

        <div className="px-5 pb-8 pt-2">
          {/* Dog photo / avatar + header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center flex-shrink-0">
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
              <h2 className="text-2xl font-bold text-[#1A1A1A]">{event.displayName}</h2>
              {event.breed && (
                <p className="text-sm text-gray-400 capitalize mt-0.5">{event.breed}</p>
              )}
              {!editing && event.matchType === 'none' && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Profile Missing
                </span>
              )}
              {!editing && event.matchType === 'fuzzy' && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                  ~ Fuzzy match
                </span>
              )}
            </div>
          </div>

          {/* ========== EDIT MODE ========== */}
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

          {/* ========== VIEW MODE ========== */}
          {!editing && (
            <>
              {/* Must Know */}
              {mustKnow && (
                <div className="bg-[#E8634A] text-white rounded-xl p-3 mb-4 flex gap-2">
                  <span className="text-lg flex-shrink-0">!</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide opacity-80 mb-0.5">Must Know</p>
                    <p className="text-sm font-medium">{mustKnow}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              {address && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-base mt-0.5">📍</span>
                      <p className="text-sm text-gray-700 leading-snug">{address}</p>
                    </div>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-[#d4552d]"
                      >
                        Open Maps
                      </a>
                    )}
                  </div>
                  {maps && (
                    <div className="flex gap-3 mt-2 ml-6">
                      <a href={maps.apple} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-400 underline underline-offset-2">Apple Maps</a>
                      <a href={maps.google} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-400 underline underline-offset-2">Google Maps</a>
                    </div>
                  )}
                </div>
              )}

              {/* Door code */}
              {doorCode && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔑</span>
                    <span className="text-sm text-gray-600 font-medium">Door / Access</span>
                  </div>
                  {doorRevealed ? (
                    <p className="mt-2 ml-6 text-sm font-mono font-semibold text-[#1A1A1A] bg-white rounded-lg px-3 py-2 border border-gray-200">
                      {doorCode}
                    </p>
                  ) : (
                    <button
                      onClick={() => setDoorRevealed(true)}
                      className="mt-2 ml-6 text-xs text-[#E8634A] font-semibold underline underline-offset-2 active:opacity-70"
                    >
                      Tap to reveal code
                    </button>
                  )}
                </div>
              )}

              {/* Extra info */}
              {extraInfo && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base">📝</span>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Extra Info</p>
                      <p className="text-sm text-gray-700">{extraInfo}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar description (raw, if no dog profile) */}
              {!dog && event.description && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Calendar Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* Admin actions */}
              {isAdmin && (
                <div className="mt-4">
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
