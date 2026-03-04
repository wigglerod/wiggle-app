import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SECTORS = ['Plateau', 'Laurier']

function DogFormModal({ dog, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: dog?.name || '',
    last_name: dog?.last_name || '',
    address: dog?.address || '',
    door_info: dog?.door_info || '',
    must_know: dog?.must_know || '',
    extra_info: dog?.extra_info || '',
    email: dog?.email || '',
    sector: dog?.sector || 'Plateau',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)

    const payload = { ...form }
    let dbError

    if (dog?.id) {
      ;({ error: dbError } = await supabase.from('dogs').update(payload).eq('id', dog.id))
    } else {
      ;({ error: dbError } = await supabase.from('dogs').insert([payload]))
    }

    if (dbError) { setError(dbError.message); setSaving(false); return }
    onSaved()
    onClose()
  }

  const fields = [
    { key: 'name', label: 'Dog Name', required: true },
    { key: 'last_name', label: 'Last Name (admin only)' },
    { key: 'address', label: 'Address' },
    { key: 'door_info', label: 'Door Info / Code' },
    { key: 'must_know', label: 'Must Know', multiline: true },
    { key: 'extra_info', label: 'Extra Info', multiline: true },
    { key: 'email', label: 'Email (admin only)', type: 'email' },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 pb-8 pt-2">
          <h2 className="text-lg font-bold mb-4">{dog ? 'Edit Dog' : 'Add Dog'}</h2>
          <div className="flex flex-col gap-3">
            {fields.map(({ key, label, required, multiline, type }) =>
              multiline ? (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">{label}</label>
                  <textarea
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A] resize-none"
                  />
                </div>
              ) : (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                    {label} {required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={type || 'text'}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
                  />
                </div>
              )
            )}

            {/* Sector */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Sector</label>
              <div className="flex gap-2">
                {SECTORS.map((s) => (
                  <button
                    key={s}
                    onClick={() => set('sector', s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
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
          </div>

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Admin() {
  const { isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [dogs, setDogs] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [sectorFilter, setSectorFilter] = useState('both')
  const [editingDog, setEditingDog] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState('dogs')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!isAdmin) navigate('/')
  }, [isAdmin, navigate])

  async function fetchData() {
    setLoading(true)
    const [{ data: dogsData }, { data: logsData }] = await Promise.all([
      supabase.from('dogs').select('*').order('name'),
      supabase.from('walk_logs').select('*, dogs(name), profiles(email)').order('walk_date', { ascending: false }).limit(50),
    ])
    setDogs(dogsData || [])
    setLogs(logsData || [])
    setLoading(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect -- fetch from external DB on mount */
  useEffect(() => {
    fetchData()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function deleteDog(id) {
    if (!confirm('Delete this dog profile?')) return
    await supabase.from('dogs').delete().eq('id', id)
    fetchData()
  }

  async function handlePhotoUpload(dog, file) {
    const ext = file.name.split('.').pop()
    const path = `dogs/${dog.id}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); return }
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
    await supabase.from('dogs').update({ photo_url: publicUrl }).eq('id', dog.id)
    fetchData()
  }

  const filteredDogs = sectorFilter === 'both'
    ? dogs
    : dogs.filter((d) => d.sector === sectorFilter)

  const statusColors = {
    completed: 'bg-green-100 text-green-700',
    skipped: 'bg-amber-100 text-amber-700',
    incident: 'bg-red-100 text-red-700',
  }

  return (
    <div className="min-h-screen bg-[#FFF4F1]">
      {/* Admin header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="text-sm text-gray-400">← Schedule</a>
            <span className="text-gray-200">/</span>
            <h1 className="text-base font-bold text-[#1A1A1A]">
              <span className="text-[#E8634A]">Admin</span> Dashboard
            </h1>
          </div>
          <button
            onClick={signOut}
            className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium"
          >
            Sign out
          </button>
        </div>

        {/* Sector filter */}
        <div className="flex gap-1.5 mt-3">
          {['both', 'Plateau', 'Laurier'].map((s) => (
            <button
              key={s}
              onClick={() => setSectorFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                sectorFilter === s
                  ? 'bg-[#E8634A] text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {s === 'both' ? 'All' : s}
            </button>
          ))}
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex bg-white border-b border-gray-100 sticky top-[88px] z-20">
        {['dogs', 'logs'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-all border-b-2 ${
              activeTab === tab
                ? 'border-[#E8634A] text-[#E8634A]'
                : 'border-transparent text-gray-400'
            }`}
          >
            {tab === 'dogs' ? '🐾 Dogs' : '📋 Walk Logs'}
          </button>
        ))}
      </div>

      <main className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {/* Action row */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setEditingDog(null); setShowForm(true) }}
            className="flex-1 py-2.5 rounded-xl bg-[#E8634A] text-white text-sm font-bold shadow-sm active:bg-[#d4552d]"
          >
            + Add Dog
          </button>
          <button
            onClick={async () => {
              setSyncing(true)
              // Phase 2: trigger Google Sheets / Calendar sync
              await new Promise((r) => setTimeout(r, 1200))
              setSyncing(false)
              alert('Sync complete (live sync enabled in Phase 2)')
            }}
            className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-semibold shadow-sm active:bg-gray-50"
          >
            {syncing ? '⏳' : '🔄'} Sync
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-[#E8634A] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Dogs tab */}
        {!loading && activeTab === 'dogs' && (
          <div className="flex flex-col gap-3">
            {filteredDogs.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No dogs in this sector yet.</p>
            )}
            {filteredDogs.map((dog) => (
              <div key={dog.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-3">
                  {/* Photo */}
                  <label className="w-12 h-12 rounded-xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center cursor-pointer flex-shrink-0 relative group">
                    {dog.photo_url ? (
                      <img src={dog.photo_url} alt={dog.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🐶</span>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-all">
                      <span className="text-white text-xs">📷</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files[0] && handlePhotoUpload(dog, e.target.files[0])}
                    />
                  </label>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#1A1A1A]">{dog.name}</h3>
                      {dog.sector && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                          {dog.sector}
                        </span>
                      )}
                    </div>
                    {dog.address && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{dog.address}</p>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setEditingDog(dog); setShowForm(true) }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-sm active:bg-gray-200"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteDog(dog.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 text-sm active:bg-red-100"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {dog.must_know && (
                  <div className="bg-[#E8634A] text-white rounded-lg px-3 py-1.5 text-xs font-medium">
                    ⚠️ {dog.must_know}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Logs tab */}
        {!loading && activeTab === 'logs' && (
          <div className="flex flex-col gap-2">
            {logs.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No walk logs yet.</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-[#1A1A1A]">
                      {log.dogs?.name || 'Unknown dog'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {log.walk_date} · {log.profiles?.email || 'Unknown walker'}
                    </p>
                    {log.notes && (
                      <p className="text-xs text-gray-500 mt-1.5 italic">{log.notes}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold capitalize flex-shrink-0 ${statusColors[log.status] || 'bg-gray-100 text-gray-500'}`}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Dog form modal */}
      {showForm && (
        <DogFormModal
          dog={editingDog}
          onClose={() => setShowForm(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}
