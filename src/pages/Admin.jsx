import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { assertFreshOrThrow, StaleBundleError } from '../lib/freshBundle'
import { useAuth } from '../context/AuthContext'
import LoadingDog from '../components/LoadingDog'
import OwlNotesTab from '../components/OwlNotesTab'
import BeastChat from '../components/BeastChat'

const SECTORS = ['Plateau', 'Laurier']

// ── Dog autocomplete input ──────────────────────────────────────────
function DogAutocompleteInput({ value, onChange, dogs, placeholder }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownIndex, setDropdownIndex] = useState(0)
  const inputRef = useRef(null)

  const options = useMemo(() => {
    const q = query.toLowerCase()
    const list = dogs.map((d) => d.dog_name)
    if (!q) return list.slice(0, 8)
    return list.filter((name) => name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, dogs])

  function handleChange(e) {
    const val = e.target.value
    // Strip @ prefix for display but keep it
    const clean = val.startsWith('@') ? val.slice(1) : val
    setQuery(clean)
    onChange(clean)
    setShowDropdown(true)
    setDropdownIndex(0)
  }

  function selectOption(name) {
    onChange(name)
    setQuery(name)
    setShowDropdown(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e) {
    if (!showDropdown || options.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIndex((i) => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); selectOption(options[dropdownIndex]) }
    else if (e.key === 'Escape') setShowDropdown(false)
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value ? `@${value}` : ''}
        onChange={handleChange}
        onFocus={() => { setShowDropdown(true); setQuery(value || '') }}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
      />
      {showDropdown && options.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {options.map((name, i) => (
            <button
              key={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectOption(name)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                i === dropdownIndex ? 'bg-[#FFF4F1]' : ''
              }`}
            >
              <span className="text-gray-400">🐕</span>
              <span className="text-gray-700 font-medium">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Walk History Search Section ──────────────────────────────────────
function WalkHistorySearch({ dogs }) {
  const [dog1, setDog1] = useState('')
  const [dog2, setDog2] = useState('')
  const [result, setResult] = useState(null)
  const [searching, setSearching] = useState(false)

  async function handleSearch() {
    if (!dog1 || !dog2) { toast.error('Select two dogs'); return }
    if (dog1 === dog2) { toast.error('Select two different dogs'); return }
    setSearching(true)
    setResult(null)

    // Query all walk_groups that contain either dog
    const dog1Obj = dogs.find((d) => d.dog_name === dog1)
    const dog2Obj = dogs.find((d) => d.dog_name === dog2)
    if (!dog1Obj || !dog2Obj) { toast.error('Dog not found in database'); setSearching(false); return }

    const { data, error } = await supabase
      .from('walk_groups')
      .select('walk_date, group_num, group_name, dog_ids, sector')
      .order('walk_date', { ascending: false })

    if (error) { toast.error('Search failed'); setSearching(false); return }

    // Find groups where both dogs' event IDs overlap
    // Since dog_ids stores event IDs (not dog UUIDs), we need to look for patterns
    // For history, we match by checking if both dog names appear in the same group
    // We'll need to match via dog_ids — but dog_ids are session-specific _id counters
    // Better approach: query walk_groups and cross-reference with walk date events
    // For now, use a simpler heuristic: look for groups that contain IDs for both dogs

    // Actually, we should store dog names or IDs in a history table. Since we don't have that,
    // let's query walk_groups and check dog_ids arrays for co-occurrence
    // The _id values are sequential per session, so we need a different approach.

    // Let's check the walk_logs table for co-occurrence on same walk_date
    const { data: logs1 } = await supabase
      .from('walk_logs')
      .select('walk_date, notes, status')
      .eq('dog_id', dog1Obj.id)
      .order('walk_date', { ascending: false })

    const { data: logs2 } = await supabase
      .from('walk_logs')
      .select('walk_date, notes, status')
      .eq('dog_id', dog2Obj.id)
      .order('walk_date', { ascending: false })

    const dates1 = new Set((logs1 || []).map((l) => l.walk_date))
    const dates2 = new Set((logs2 || []).map((l) => l.walk_date))
    const sharedDates = [...dates1].filter((d) => dates2.has(d)).sort().reverse()

    setResult({
      dog1,
      dog2,
      count: sharedDates.length,
      dates: sharedDates,
      first: sharedDates.length > 0 ? sharedDates[sharedDates.length - 1] : null,
      last: sharedDates.length > 0 ? sharedDates[0] : null,
    })
    setSearching(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Have two dogs walked together?</h3>
      <div className="flex gap-2 mb-3">
        <DogAutocompleteInput value={dog1} onChange={setDog1} dogs={dogs} placeholder="@dog1" />
        <DogAutocompleteInput value={dog2} onChange={setDog2} dogs={dogs} placeholder="@dog2" />
      </div>
      <button
        onClick={handleSearch}
        disabled={searching || !dog1 || !dog2}
        className="w-full py-2.5 rounded-xl bg-[#E8634A] text-white text-sm font-bold disabled:opacity-50 active:bg-[#d4552d]"
      >
        {searching ? 'Searching...' : 'Search'}
      </button>

      {result && (
        <div className="mt-4 bg-[#FFF4F1] rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-800">
            {result.dog1} and {result.dog2} walked together{' '}
            <span className="text-[#E8634A]">{result.count} time{result.count !== 1 ? 's' : ''}</span>
          </p>
          {result.count > 0 && (
            <>
              <button
                onClick={() => setResult(r => ({ ...r, showExtra: !r.showExtra }))}
                className="text-xs text-gray-400 mt-1 active:text-gray-600"
              >
                Extra info {result.showExtra ? '▴' : '▾'}
              </button>
              {result.showExtra && (
                <div className="mt-2 text-xs text-gray-500">
                  <p>First: {new Date(result.first).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <p>Last: {new Date(result.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.dates.slice(0, 10).map((d) => (
                      <span key={d} className="bg-white px-2 py-0.5 rounded-full">
                        {new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ))}
                    {result.dates.length > 10 && (
                      <span className="text-gray-400">+{result.dates.length - 10} more</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dog Conflicts Section ──────────────────────────────────────────
function DogConflictsSection({ dogs }) {
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)
  const [dog1, setDog1] = useState('')
  const [dog2, setDog2] = useState('')
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)

  async function loadConflicts() {
    setLoading(true)
    const { data } = await supabase.from('dog_conflicts').select('*').order('created_at', { ascending: false })
    setConflicts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadConflicts() }, [])

  async function handleAdd() {
    if (!dog1 || !dog2) { toast.error('Select two dogs'); return }
    if (dog1 === dog2) { toast.error('Select two different dogs'); return }
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setAdding(true)
    const { error } = await supabase.from('dog_conflicts').insert({
      dog_1_name: dog1,
      dog_2_name: dog2,
      reason: reason || null,
    })
    if (error) toast.error('Failed to add conflict')
    else {
      toast.success('Conflict rule added')
      setDog1(''); setDog2(''); setReason('')
      loadConflicts()
    }
    setAdding(false)
  }

  async function handleDelete(id) {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    const { error } = await supabase.from('dog_conflicts').delete().eq('id', id)
    if (error) toast.error('Failed to remove')
    else { toast('Conflict removed'); loadConflicts() }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Not Allowed Together</h3>

      {/* Add conflict form */}
      <div className="flex gap-2 mb-2">
        <DogAutocompleteInput value={dog1} onChange={setDog1} dogs={dogs} placeholder="@dog1" />
        <DogAutocompleteInput value={dog2} onChange={setDog2} dogs={dogs} placeholder="@dog2" />
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A] mb-2"
      />
      <button
        onClick={handleAdd}
        disabled={adding || !dog1 || !dog2}
        className="w-full py-2 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-50 active:bg-amber-600"
      >
        {adding ? 'Adding...' : '+ Add Conflict Rule'}
      </button>

      {/* Conflict list */}
      {loading && <p className="text-xs text-gray-400 py-4 text-center">Loading...</p>}
      {!loading && conflicts.length === 0 && (
        <p className="text-xs text-gray-400 py-4 text-center">No conflict rules yet.</p>
      )}
      {!loading && conflicts.map((c) => (
        <div key={c.id} className="flex items-center justify-between py-2 border-t border-gray-50 mt-2">
          <div>
            <p className="text-sm font-medium text-gray-700">
              ⚠️ {c.dog_1_name} & {c.dog_2_name}
            </p>
            {c.reason && <p className="text-xs text-gray-400">{c.reason}</p>}
          </div>
          <button
            onClick={() => handleDelete(c.id)}
            className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-400 font-medium active:bg-red-100"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}

const LEVEL_OPTIONS = [
  { value: 1, label: 'Chill', color: 'bg-green-500' },
  { value: 2, label: 'Caution', color: 'bg-yellow-400' },
  { value: 3, label: 'Extra Care', color: 'bg-red-500' },
]

function DogFormModal({ dog, onClose, onSaved }) {
  const [form, setForm] = useState({
    dog_name:    dog?.dog_name    || '',
    owner_first: dog?.owner_first || '',
    owner_last:  dog?.owner_last  || '',
    breed:       dog?.breed       || '',
    address:     dog?.address     || '',
    building_access: dog?.building_access || '',
    unit_number:     dog?.unit_number     || '',
    unit_access:     dog?.unit_access     || '',
    access_notes:    dog?.access_notes    || '',
    phone:       dog?.phone       || '',
    email:       dog?.email       || '',
    notes:       dog?.notes       || '',
    bff:         dog?.bff         || '',
    goals:       dog?.goals       || '',
    sector:      dog?.sector      || 'Plateau',
    level:       dog?.level       || 1,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }))
  }

  async function handleSave() {
    if (!form.dog_name.trim()) { setError('Name is required'); return }
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
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
    { key: 'dog_name',    label: 'Dog Name', required: true },
    { key: 'breed',       label: 'Breed' },
    { key: 'owner_first', label: 'Owner First Name' },
    { key: 'owner_last',  label: 'Owner Last Name' },
    { key: 'address',     label: 'Address' },
    { key: 'building_access', label: '🏢 Building Access' },
    { key: 'unit_number',     label: '🚪 Unit Number' },
    { key: 'unit_access',     label: '🔑 Unit Access' },
    { key: 'access_notes',    label: '📝 Access Notes' },
    { key: 'phone',       label: 'Phone' },
    { key: 'email',       label: 'Email', type: 'email' },
    { key: 'notes',       label: 'Notes', multiline: true },
    { key: 'bff',         label: 'BFF (Best Friends)' },
    { key: 'goals',       label: 'Goals' },
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

            {/* Level */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Level</label>
              <div className="flex gap-2">
                {LEVEL_OPTIONS.map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => set('level', value)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
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

function SystemSection({ dogs }) {
  const [profiles, setProfiles] = useState([])
  const [notesToday, setNotesToday] = useState(0)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const [profilesRes, notesRes, backupsRes] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, role, sector, schedule').order('full_name'),
        supabase.from('owl_notes').select('id', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00'),
        supabase.from('backups_log').select('*').order('backup_date', { ascending: false }).limit(7),
      ])
      setProfiles(profilesRes.data || [])
      setNotesToday(notesRes.count || 0)
      setBackups(backupsRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function runBackup() {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setBacking(true)
    try {
      const res = await fetch('/api/cron/backup-dogs?manual=true', { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        toast.success(`Backup saved! ${result.dogCount} dogs protected.`)
        const { data } = await supabase.from('backups_log').select('*').order('backup_date', { ascending: false }).limit(7)
        setBackups(data || [])
      } else {
        toast.error(`Backup failed: ${result.message || result.error}`)
      }
    } catch {
      toast.error('Backup request failed')
    }
    setBacking(false)
  }

  const walkerCount = profiles.filter(p => ['admin', 'senior_walker', 'junior_walker'].includes(p.role)).length
  const last = backups[0]

  const ROLE_LABELS = { admin: 'Admin', senior_walker: 'Senior', junior_walker: 'Junior' }
  const ROLE_COLORS = { admin: 'bg-purple-100 text-purple-700', senior_walker: 'bg-blue-100 text-blue-700', junior_walker: 'bg-green-100 text-green-700' }

  return (
    <div className="flex flex-col gap-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-[#E8634A]">{dogs.length}</p>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Dogs</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-[#E8634A]">{walkerCount}</p>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Walkers</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-[#E8634A]">{notesToday}</p>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Notes today</p>
        </div>
      </div>

      {/* Profiles list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Team</h3>
        {loading && <p className="text-xs text-gray-400 py-4 text-center">Loading...</p>}
        {!loading && profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{p.full_name || p.email}</p>
              {p.full_name && <p className="text-xs text-gray-400 truncate">{p.email}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {p.sector && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                  {p.sector}
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-500'}`}>
                {ROLE_LABELS[p.role] || p.role}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Advanced — collapsible */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 active:bg-gray-50"
      >
        <span>Advanced</span>
        <span className="text-xs">{showAdvanced ? '▴' : '▾'}</span>
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-4">
          {/* Backup */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">Database Protection</h3>
            <p className="text-xs text-gray-400 mb-4">{dogs.length} dogs, audit logging, nightly backups at 2 AM ET</p>
            <button
              onClick={runBackup}
              disabled={backing}
              className="w-full py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold shadow-sm active:bg-[#d4552d] disabled:opacity-50 transition-all"
            >
              {backing ? 'Backing up...' : '📦 Backup Now'}
            </button>
            {last && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Last backup: {new Date(last.backup_date).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' })}
                {' '}({last.dog_count} dogs) — {last.status === 'success' ? '✅' : '❌'}
              </p>
            )}
          </div>

          {/* Backup History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Backup History (last 7)</h3>
            {loading && <p className="text-xs text-gray-400 py-4 text-center">Loading...</p>}
            {!loading && backups.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">No backups yet.</p>
            )}
            {!loading && backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {new Date(b.backup_date).toLocaleDateString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(b.backup_date).toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', timeStyle: 'short' })}
                    {' · '}{b.dog_count} dogs
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  b.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {b.status === 'success' ? '✅ OK' : '❌ Failed'}
                </span>
              </div>
            ))}
          </div>

          {/* Protection Status */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Protection Status</h3>
            <div className="flex flex-col gap-1.5 text-xs">
              <p className="text-gray-600">✅ DROP TABLE blocked (event trigger)</p>
              <p className="text-gray-600">✅ TRUNCATE blocked (statement trigger)</p>
              <p className="text-gray-600">✅ Audit log on every INSERT/UPDATE/DELETE</p>
              <p className="text-gray-600">✅ Nightly backup at 2:00 AM ET</p>
              <p className="text-gray-600">✅ Seed script requires --force if table has data</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Today Tab — operational command center ─────────────────────────
const STATUS_CONFIG = {
  done:     { dot: 'bg-[#0F6E56]', text: 'text-[#0F6E56]', badge: 'bg-[#E1F5EE] text-[#0F6E56]', label: 'Done' },
  walking:  { dot: 'bg-[#E8634A]', text: 'text-[#E8634A]', badge: 'bg-[#FAECE7] text-[#993C1D]', label: 'Walking' },
  planning: { dot: 'bg-gray-300',  text: 'text-gray-400',  badge: 'bg-gray-100 text-gray-400',    label: 'Planning' },
}

function TodayTab({ userSector, isChiefPup }) {
  const [groups, setGroups] = useState([])
  const [pickupDogIds, setPickupDogIds] = useState(new Set())
  const [walkerMap, setWalkerMap] = useState({})
  const [dogMap, setDogMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [beastOpen, setBeastOpen] = useState(false)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })

  useEffect(() => {
    async function load() {
      setLoading(true)
      let groupsQuery = supabase
        .from('walk_groups')
        .select('*')
        .eq('walk_date', today)
      if (!isChiefPup && userSector && userSector !== 'both') {
        groupsQuery = groupsQuery.eq('sector', userSector)
      }

      const [groupsRes, profilesRes, dogsRes, pickupsRes] = await Promise.all([
        groupsQuery.order('group_num'),
        supabase.from('profiles').select('id, full_name').in('role', ['admin', 'senior_walker', 'junior_walker']),
        supabase.from('dogs').select('id, dog_name'),
        supabase.from('walker_notes').select('dog_id').eq('walk_date', today).eq('note_type', 'pickup'),
      ])

      setGroups(groupsRes.data || [])
      const wMap = {}
      for (const p of (profilesRes.data || [])) wMap[p.id] = p.full_name
      setWalkerMap(wMap)
      const dMap = {}
      for (const d of (dogsRes.data || [])) dMap[d.id] = d.dog_name
      setDogMap(dMap)
      setPickupDogIds(new Set((pickupsRes.data || []).map(r => r.dog_id)))
      setLoading(false)
    }
    load()
  }, [today, userSector, isChiefPup])

  if (loading) return <div className="flex justify-center py-12"><LoadingDog /></div>

  const sectors = isChiefPup ? ['Plateau', 'Laurier'] : [userSector || 'Plateau']

  function groupStatus(g) {
    const dogIds = g.dog_ids || []
    const pickedCount = dogIds.filter(id => pickupDogIds.has(id)).length
    if (dogIds.length > 0 && pickedCount === dogIds.length) return 'done'
    if (g.locked) return 'walking'
    return 'planning'
  }

  // Sector summaries
  const sectorSummaries = sectors.map(sector => {
    const sg = groups.filter(g => g.sector === sector)
    const allDogIds = sg.flatMap(g => g.dog_ids || [])
    const pickedCount = allDogIds.filter(id => pickupDogIds.has(id)).length
    const walkerIds = [...new Set(sg.flatMap(g => g.walker_ids || []))]
    const walkerNames = walkerIds.map(id => walkerMap[id]?.split(' ')[0]).filter(Boolean)
    const allDone = allDogIds.length > 0 && pickedCount === allDogIds.length
    const anyLocked = sg.some(g => g.locked)
    return { sector, dogCount: allDogIds.length, walkerNames, status: allDone ? 'done' : anyLocked ? 'walking' : 'planning' }
  })

  // Sort groups: walking → planning → done
  const sortedGroups = groups.slice().sort((a, b) => {
    const order = { walking: 0, planning: 1, done: 2 }
    return (order[groupStatus(a)] ?? 1) - (order[groupStatus(b)] ?? 1)
  })

  // Alerts
  const alerts = []
  for (const g of groups) {
    if ((!g.walker_ids || g.walker_ids.length === 0) && (g.dog_ids?.length > 0)) {
      alerts.push(`${g.group_name || `Group ${g.group_num}`} (${g.sector}) has no walker assigned`)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      {sectorSummaries.map(s => {
        const cfg = STATUS_CONFIG[s.status]
        return (
          <div key={s.sector} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} flex-shrink-0`} />
              <span className="font-semibold text-sm text-[#333]">{s.sector}</span>
              <span className="text-xs text-gray-400">{s.dogCount} dogs</span>
              {s.walkerNames.length > 0 && (
                <span className="text-xs text-gray-400 truncate">{s.walkerNames.join(', ')}</span>
              )}
            </div>
            <span className={`text-xs font-semibold ${cfg.text} flex-shrink-0`}>{cfg.label}</span>
          </div>
        )
      })}

      {/* Alerts — only if something needs attention */}
      {alerts.length > 0 && (
        <div className="bg-[#FAEEDA] border border-[#FAC775] rounded-2xl p-3">
          {alerts.map((msg, i) => (
            <p key={i} className="text-xs text-[#854F0B] font-medium">{msg}</p>
          ))}
        </div>
      )}

      {/* Groups overview */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">Groups</p>
        {sortedGroups.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No groups for today yet</p>
        )}
        {sortedGroups.map(g => {
          const dogIds = g.dog_ids || []
          const status = groupStatus(g)
          const cfg = STATUS_CONFIG[status]
          const pickedCount = dogIds.filter(id => pickupDogIds.has(id)).length
          const walkerNames = (g.walker_ids || []).map(id => walkerMap[id]?.split(' ')[0]).filter(Boolean)
          const key = `${g.group_num}_${g.sector}`
          const isExpanded = expandedGroup === key

          return (
            <div key={key}>
              <button
                onClick={() => setExpandedGroup(isExpanded ? null : key)}
                className="w-full flex items-center px-4 py-3 border-t border-gray-50 active:bg-gray-50 min-h-[44px]"
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0 mr-3`} />
                <div className="flex-1 min-w-0 text-left">
                  <span className="text-sm font-medium text-[#333]">{g.group_name || `Group ${g.group_num}`}</span>
                  {isChiefPup && <span className="text-[10px] text-gray-300 ml-1.5">{g.sector}</span>}
                  {walkerNames.length > 0 && (
                    <span className="text-xs text-gray-400 ml-2">{walkerNames.join(', ')}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 mr-2">
                  {g.locked ? `${pickedCount}/${dogIds.length}` : `${dogIds.length}`}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                <span className="text-xs text-gray-300 ml-2">{isExpanded ? '\u25B4' : '\u25BE'}</span>
              </button>
              {isExpanded && dogIds.length > 0 && (
                <div className="px-4 pb-3 pl-9">
                  <div className="flex flex-wrap gap-1">
                    {dogIds.map(id => (
                      <span key={id} className={`text-xs px-2 py-0.5 rounded-full ${
                        pickupDogIds.has(id) ? 'bg-[#E1F5EE] text-[#0F6E56] line-through' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {dogMap[id] || '?'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Owl Notes */}
      <OwlNotesTab />

      {/* Beast Chat — collapsible */}
      <button
        onClick={() => setBeastOpen(!beastOpen)}
        className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 active:bg-gray-50 w-full"
      >
        <span>Beast AI Assistant</span>
        <span className="text-xs">{beastOpen ? '\u25B4' : '\u25BE'}</span>
      </button>
      {beastOpen && <BeastChat />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//   MAIN ADMIN EXPORT
// ══════════════════════════════════════════════════════════════════════
export default function Admin() {
  const { permissions, profile, canDelete, signOut } = useAuth()
  const isChiefPup = profile?.role === 'admin'
  const userSector = profile?.sector || 'both'

  const [mainTab, setMainTab] = useState('today')

  // ── Manage tab state ──────────────────────────────────────────────
  const [dogs, setDogs] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [sectorFilter, setSectorFilter] = useState('both')
  const [editingDog, setEditingDog] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [manageTab, setManageTab] = useState('dogs')
  const [syncing, setSyncing] = useState(false)
  const [manageLoaded, setManageLoaded] = useState(false)

  async function fetchManageData() {
    setLoading(true)
    const [{ data: dogsData, error: dogsErr }, { data: logsData, error: logsErr }] = await Promise.all([
      supabase.from('dogs').select('*').order('dog_name'),
      supabase.from('walk_logs').select('*, dogs(dog_name), profiles(email)').order('walk_date', { ascending: false }).limit(50),
    ])
    if (dogsErr || logsErr) toast.error('Failed to load some data')
    setDogs(dogsData || [])
    setLogs(logsData || [])
    setLoading(false)
    setManageLoaded(true)
  }

  // Lazy-load manage data only when tab is selected
  useEffect(() => {
    if (mainTab === 'manage' && !manageLoaded) fetchManageData()
  }, [mainTab, manageLoaded])

  async function deleteDog(id) {
    if (!confirm('Delete this dog profile?')) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    const { error } = await supabase.from('dogs').delete().eq('id', id)
    if (error) { toast.error('Failed to delete dog profile'); return }
    toast.success('Dog profile deleted')
    fetchManageData()
  }

  async function handlePhotoUpload(dog, file) {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    const ext = file.name.split('.').pop()
    const path = `dogs/${dog.id}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); return }
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
    const { error: updateError } = await supabase.from('dogs').update({ photo_url: publicUrl }).eq('id', dog.id)
    if (updateError) { toast.error('Failed to save photo'); return }
    toast.success('Photo uploaded')
    fetchManageData()
  }

  const filteredDogs = sectorFilter === 'both' ? dogs : dogs.filter((d) => d.sector === sectorFilter)

  const statusColors = {
    completed: 'bg-green-100 text-green-700',
    skipped: 'bg-amber-100 text-amber-700',
    incident: 'bg-red-100 text-red-700',
  }

  const showManageTab = isChiefPup

  return (
    <div className="min-h-screen bg-[#FFF4F1]">
      {/* Admin header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="text-sm text-gray-400">{'\u2190'} Schedule</a>
            <span className="text-gray-200">/</span>
            <h1 className="text-base font-bold text-[#1A1A1A]">
              <span className="text-[#E8634A]">Admin</span> Dashboard
            </h1>
          </div>
          <button onClick={signOut} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
            Sign out
          </button>
        </div>

        {/* Today / Manage pill toggle */}
        {showManageTab && (
          <div className="flex gap-1.5 mt-3 bg-[#f0ece8] rounded-full p-1">
            {['today', 'manage'].map(tab => (
              <button
                key={tab}
                onClick={() => setMainTab(tab)}
                className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
                  mainTab === tab ? 'bg-[#E8634A] text-white shadow-sm' : 'text-gray-500'
                }`}
              >
                {tab === 'today' ? 'Today' : 'Manage'}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {/* ── TODAY TAB ──────────────────────────────────────────── */}
        {mainTab === 'today' && (
          <TodayTab userSector={userSector} isChiefPup={isChiefPup} />
        )}

        {/* ── MANAGE TAB (Chief Pup only) ────────────────────────── */}
        {mainTab === 'manage' && showManageTab && (
          <>
            {/* Sector filter */}
            <div className="flex gap-1.5 mb-3">
              {['both', 'Plateau', 'Laurier'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSectorFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    sectorFilter === s ? 'bg-[#E8634A] text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s === 'both' ? 'All' : s}
                </button>
              ))}
            </div>

            {/* Sub-tab bar */}
            <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 mb-3 overflow-hidden">
              {['dogs', 'logs', 'system'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setManageTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-all border-b-2 ${
                    manageTab === tab ? 'border-[#E8634A] text-[#E8634A]' : 'border-transparent text-gray-400'
                  }`}
                >
                  {tab === 'dogs' ? 'Dogs' : tab === 'logs' ? 'Logs & Conflicts' : 'System'}
                </button>
              ))}
            </div>

            {/* Action row (Dogs tab only) */}
            {manageTab === 'dogs' && (
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
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
                    try {
                      const res = await fetch(`/api/acuity?date=${today}`)
                      if (res.ok) {
                        const events = await res.json()
                        setSyncing(false)
                        toast.success(`Acuity sync OK: ${events.length} appointments today`)
                      } else {
                        const err = await res.json().catch(() => ({}))
                        setSyncing(false)
                        toast.error(`Acuity returned ${res.status}: ${err.error || 'Check env vars'}`)
                      }
                    } catch {
                      setSyncing(false)
                      toast.error('Acuity API unreachable')
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-semibold shadow-sm active:bg-gray-50"
                >
                  {syncing ? '...' : 'Sync'}
                </button>
              </div>
            )}

            {loading && <div className="flex justify-center py-12"><LoadingDog /></div>}

            {/* Dogs sub-tab */}
            {!loading && manageTab === 'dogs' && (
              <div className="flex flex-col gap-3">
                {filteredDogs.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No dogs in this sector yet.</p>}
                {filteredDogs.map((dog) => (
                  <div key={dog.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <label className="w-12 h-12 rounded-xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center cursor-pointer flex-shrink-0 relative group">
                        {dog.photo_url ? (
                          <img src={dog.photo_url} alt={dog.dog_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{'\u{1F436}'}</span>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-all">
                          <span className="text-white text-xs">{'\u{1F4F7}'}</span>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handlePhotoUpload(dog, e.target.files[0])} />
                      </label>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dog.level === 3 ? 'bg-red-500' : dog.level === 2 ? 'bg-yellow-400' : 'bg-green-500'}`} />
                          <h3 className="font-bold text-[#1A1A1A]">{dog.dog_name}</h3>
                          {dog.sector && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{dog.sector}</span>}
                        </div>
                        {dog.breed && <p className="text-xs text-gray-400 truncate mt-0.5">{dog.breed}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setEditingDog(dog); setShowForm(true) }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-sm active:bg-gray-200">{'\u270F\uFE0F'}</button>
                        {canDelete && <button onClick={() => deleteDog(dog.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 text-sm active:bg-red-100">{'\u{1F5D1}\uFE0F'}</button>}
                      </div>
                    </div>
                    {dog.notes && <div className="bg-[#E8634A] text-white rounded-lg px-3 py-1.5 text-xs font-medium">{dog.notes}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Logs sub-tab */}
            {!loading && manageTab === 'logs' && (
              <div className="flex flex-col gap-2">
                <WalkHistorySearch dogs={dogs} />
                <DogConflictsSection dogs={dogs} />
                <h3 className="text-sm font-bold text-gray-700 mt-2 mb-1">Recent Walk Logs</h3>
                {logs.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No walk logs yet.</p>}
                {logs.map((log) => (
                  <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-[#1A1A1A]">{log.dogs?.dog_name || 'Unknown dog'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{log.walk_date} {'\u00B7'} {log.profiles?.email || 'Unknown walker'}</p>
                        {log.notes && <p className="text-xs text-gray-500 mt-1.5 italic">{log.notes}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold capitalize flex-shrink-0 ${statusColors[log.status] || 'bg-gray-100 text-gray-500'}`}>{log.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* System sub-tab */}
            {!loading && manageTab === 'system' && <SystemSection dogs={dogs} />}
          </>
        )}
      </main>

      {/* Dog form modal */}
      {showForm && (
        <DogFormModal
          dog={editingDog}
          onClose={() => setShowForm(false)}
          onSaved={fetchManageData}
        />
      )}
    </div>
  )
}
