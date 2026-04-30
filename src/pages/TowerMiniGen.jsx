import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { assertFreshOrThrow, StaleBundleError } from '../lib/freshBundle'
import { toast } from 'sonner'

/* ── helpers ────────────────────────────────────────── */

function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Turn a raw flag object from mini_gen_drafts.flags into plain language. */
function formatFlag(flag) {
  if (flag.type === 'conflict') {
    return {
      message: `${flag.dog1} and ${flag.dog2} are both booked in the same sector`,
      instruction: 'Resolve in Acuity — rebook one dog on a different day, then Run Mini Gen again.',
      borderColor: '#E8634A',
      bg: '#FAECE7',
    }
  }
  if (flag.type === 'vacation') {
    return {
      message: `${flag.dogName} is booked but shouldn't be walking`,
      instruction: null,
      borderColor: '#C4851C',
      bg: '#FDF3E3',
    }
  }
  if (flag.type === 'unresolved') {
    return {
      message: `"${flag.ownerName}" couldn't be matched to a dog`,
      instruction: null,
      borderColor: '#475569',
      bg: '#F0ECE8',
    }
  }
  if (flag.type === 'capacity') {
    return {
      message: `${flag.count} dogs — ${flag.level === 'critical' ? 'way over' : 'near'} capacity`,
      instruction: `Consider moving some dogs to balance the load`,
      borderColor: '#534AB7',
      bg: '#EEEDFE',
    }
  }
  return {
    message: flag.reason || JSON.stringify(flag),
    instruction: 'Review this flag manually',
    borderColor: '#475569',
    bg: '#F0ECE8',
  }
}

/* ── sub-components ─────────────────────────────────── */

function UnresolvedFixForm({ flag, onFixed }) {
  const [query, setQuery] = useState('')
  const [dogs, setDogs] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mapped, setMapped] = useState(false)

  useEffect(() => {
    supabase.from('dogs').select('dog_name').order('dog_name').then(({ data }) => {
      if (data) setDogs(data.map(d => d.dog_name))
    })
  }, [])

  const filtered = query.length >= 1
    ? dogs.filter(n => n.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  async function handleSave() {
    if (!query.trim()) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setSaving(true)
    try {
      const res = await fetch('/api/tower-add-name-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acuity_name: flag.ownerName, dog_name: query.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setMapped(true)
      toast.success(`Mapped "${flag.ownerName}" → ${query.trim()}`)
      onFixed()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (mapped) {
    return <p className="text-[11px] font-medium mt-2" style={{ color: '#2D8F6F' }}>✓ Mapped</p>
  }

  return (
    <div className="mt-2 relative">
      <label className="text-[10px] font-medium" style={{ color: '#475569' }}>Which dog is this?</label>
      <div className="flex gap-2 mt-1">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDrop(true) }}
            onFocus={() => query.length >= 1 && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="Search dog name…"
            className="w-full px-2 py-1.5 rounded-md text-[12px]"
            style={{ border: '1px solid #E8E4E0', background: '#FAF7F4', color: '#2D2926', fontFamily: 'DM Sans, sans-serif' }}
          />
          {showDrop && filtered.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-md shadow-md z-10 overflow-hidden"
              style={{ background: '#FAF7F4', border: '1px solid #E8E4E0' }}
            >
              {filtered.map(name => (
                <button
                  key={name}
                  className="block w-full text-left px-3 py-2 text-[12px] hover:bg-[#F0ECE8]"
                  style={{ color: '#2D2926', fontFamily: 'DM Sans, sans-serif' }}
                  onMouseDown={() => { setQuery(name); setShowDrop(false) }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !query.trim()}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold text-white disabled:opacity-50 whitespace-nowrap"
          style={{ background: '#2D8F6F' }}
        >
          {saving ? '…' : 'Save to name map'}
        </button>
      </div>
    </div>
  )
}

function VacationRemoveBtn({ draft, flag, onFixed }) {
  const [busy, setBusy] = useState(false)
  const [removed, setRemoved] = useState(false)

  async function handleRemove() {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setBusy(true)
    try {
      const { data: current, error: readErr } = await supabase
        .from('mini_gen_drafts')
        .select('dog_names, dog_uuids, flags')
        .eq('id', draft.id)
        .single()
      if (readErr) throw readErr

      const idx = current.dog_names.indexOf(flag.dogName)
      const newNames = current.dog_names.filter(n => n !== flag.dogName)
      const newUuids = idx >= 0
        ? current.dog_uuids.filter((_, i) => i !== idx)
        : current.dog_uuids
      const newFlags = (current.flags || []).filter(
        f => !(f.type === 'vacation' && f.dogName === flag.dogName)
      )

      const { error: updateErr } = await supabase
        .from('mini_gen_drafts')
        .update({ dog_names: newNames, dog_uuids: newUuids, flags: newFlags })
        .eq('id', draft.id)
      if (updateErr) throw updateErr

      setRemoved(true)
      toast.success(`Removed ${flag.dogName} from this day`)
      onFixed()
    } catch (e) {
      toast.error(e.message || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  if (removed) {
    return <p className="text-[11px] font-medium mt-2" style={{ color: '#2D8F6F' }}>✓ Removed</p>
  }

  return (
    <button
      onClick={handleRemove}
      disabled={busy}
      className="mt-2 px-3 py-1.5 rounded-md text-[11px] font-bold text-white disabled:opacity-50"
      style={{ background: '#C4851C' }}
    >
      {busy ? '…' : 'Remove from this day'}
    </button>
  )
}

function FlaggedDraftCard({ draft, onAction, userId }) {
  const [busy, setBusy] = useState(null)
  const sectorColor = draft.sector === 'Plateau' ? '#3B82A0' : '#4A9E6F'
  const flags = draft.flags || []

  async function handleAction(action) {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setBusy(action)
    try {
      const res = await fetch('/api/tower-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, status: action === 'approve' ? 'approved' : 'rejected', userId }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success(action === 'approve' ? 'Approved' : 'Rejected')
      onAction()
    } catch (e) {
      toast.error(e.message || 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="p-[14px_16px] rounded-[10px]"
      style={{
        background: '#FAF7F4',
        border: '1px solid #E8E4E0',
        borderBottom: '2.5px solid #D5CFC8',
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold" style={{ color: sectorColor, fontFamily: 'DM Sans, sans-serif' }}>
          {fmtDate(draft.walk_date)} · {draft.sector.toUpperCase()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('approve')}
            disabled={!!busy}
            className="px-3 py-1 rounded-md text-[10px] font-bold text-white disabled:opacity-50"
            style={{ background: '#2D8F6F' }}
          >
            {busy === 'approve' ? '…' : 'Approve'}
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={!!busy}
            className="px-3 py-1 rounded-md text-[10px] font-bold text-white disabled:opacity-50"
            style={{ background: '#C4851C' }}
          >
            {busy === 'reject' ? '…' : 'Reject'}
          </button>
        </div>
      </div>

      {/* flag details */}
      <div className="flex flex-col gap-2">
        {flags.map((flag, i) => {
          const { message, instruction, borderColor, bg } = formatFlag(flag)
          return (
            <div
              key={i}
              className="p-3 rounded-lg"
              style={{ background: bg, borderLeft: `4px solid ${borderColor}` }}
            >
              <p className="text-[12px] font-medium" style={{ color: '#2D2926' }}>{message}</p>
              {instruction && (
                <p className="text-[11px] mt-1" style={{ color: '#8C857E' }}>{instruction}</p>
              )}
              {flag.type === 'unresolved' && (
                <UnresolvedFixForm flag={flag} onFixed={onAction} />
              )}
              {flag.type === 'vacation' && (
                <VacationRemoveBtn draft={draft} flag={flag} onFixed={onAction} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── main page ──────────────────────────────────────── */

export default function TowerMiniGen() {
  const { profile, session, isLoading: authLoading } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [statusLine, setStatusLine] = useState(null)
  const [running, setRunning] = useState(false)
  const [runSummary, setRunSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [approvingClean, setApprovingClean] = useState(false)

  /* ── data fetch ─── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: draftRows } = await supabase
        .from('mini_gen_drafts')
        .select('*')
        .eq('status', 'pending')
        .order('walk_date')
        .order('sector')

      setDrafts(draftRows || [])

      if (draftRows && draftRows.length > 0) {
        const latest = draftRows[0]
        setStatusLine(`Last run: ${fmtDate(latest.run_date || latest.walk_date)}`)
      } else {
        setStatusLine(null)
      }
    } catch (e) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── derived state ── */
  const cleanDrafts = drafts.filter(d => !d.flags || d.flags.length === 0)
  const flaggedDrafts = drafts.filter(d => d.flags && d.flags.length > 0)
  const cleanCount = cleanDrafts.length
  const flagCount = flaggedDrafts.reduce((n, d) => n + d.flags.length, 0)

  /* ── run Mini Gen ── */
  async function runMiniGen() {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setRunning(true)
    setRunSummary(null)
    try {
      const res = await fetch('/api/mini-gen', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setRunSummary(
        `${json.resolved ?? '?'} resolved · ${json.unresolved ?? 0} unresolved · ` +
        `${json.conflicts ?? 0} conflict${(json.conflicts ?? 0) !== 1 ? 's' : ''}`
      )
      await fetchData()
      toast.success('Mini Gen complete')
    } catch (e) {
      toast.error(e.message || 'Mini Gen failed')
    } finally {
      setRunning(false)
    }
  }

  /* ── bulk approve clean days ── */
  async function approveAllClean() {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setApprovingClean(true)
    try {
      const results = await Promise.all(
        cleanDrafts.map(d =>
          fetch('/api/tower-approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: d.id, status: 'approved', userId: session?.user?.id }),
          })
        )
      )
      const failed = results.filter(r => !r.ok).length
      if (failed) throw new Error(`${failed} approvals failed`)
      toast.success(`Approved ${cleanCount} clean day${cleanCount !== 1 ? 's' : ''}`)
      await fetchData()
    } catch (e) {
      toast.error(e.message || 'Bulk approve failed')
    } finally {
      setApprovingClean(false)
    }
  }

  /* ── auth guard ── */
  if (authLoading || (session && !profile)) return null
  if (!session) return <Navigate to="/login" replace />
  if (profile?.role !== 'admin') return <Navigate to="/" replace />

  /* ── layout ── */
  return (
    <div className="min-h-screen" style={{ background: '#FFF5F0', fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── HEADER BAR ── */}
      <header
        className="flex items-center justify-between px-5"
        style={{ background: '#2D2926', height: 56 }}
      >
        <span className="text-[16px] font-bold" style={{ color: '#E8634A' }}>
          Tower Control
        </span>
        <button
          onClick={runMiniGen}
          disabled={running}
          className="px-4 py-2 rounded-lg text-[13px] font-bold text-white disabled:opacity-60"
          style={{ background: '#E8634A' }}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Running…
            </span>
          ) : (
            'Run Mini Gen'
          )}
        </button>
      </header>

      {/* ── RUN SUMMARY (after Run) ── */}
      {runSummary && (
        <div
          className="px-5 py-2 text-[12px]"
          style={{ background: '#FAF7F4', borderBottom: '1px solid #E8E4E0', color: '#475569' }}
        >
          {runSummary}
        </div>
      )}

      {/* ── ① SUMMARY BAR ── */}
      <div
        className="px-5 py-3 text-[13px] font-medium"
        style={{ background: '#FAF7F4', borderBottom: '1px solid #E8E4E0', color: '#2D2926' }}
      >
        {loading
          ? 'Loading…'
          : drafts.length === 0
            ? (statusLine || "Mini Gen hasn't run yet. Press Run Mini Gen to start.")
            : (
              <>
                <span style={{ color: '#2D8F6F' }}>
                  ✓ {cleanCount} day{cleanCount !== 1 ? 's' : ''} clean
                </span>
                {flagCount > 0 && (
                  <span style={{ color: '#C4851C' }}>
                    {' · '}{flagCount} flag{flagCount !== 1 ? 's' : ''} need attention
                  </span>
                )}
              </>
            )
        }
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto px-5 py-6">

        {/* ── ② CLEAN DAYS — bulk approve ── */}
        {cleanCount > 0 && (
          <section className="mb-6">
            <button
              onClick={approveAllClean}
              disabled={approvingClean}
              className="w-full py-3 rounded-[10px] text-[13px] font-bold text-white disabled:opacity-60"
              style={{ background: '#2D8F6F' }}
            >
              {approvingClean ? 'Approving…' : `Approve all clean days (${cleanCount})`}
            </button>
          </section>
        )}

        {/* ── ③ FLAGGED DAYS ── */}
        {flaggedDrafts.length > 0 && (
          <section>
            <h2
              className="text-[10px] font-bold uppercase tracking-wider mb-3"
              style={{ color: '#C4851C' }}
            >
              NEEDS ATTENTION
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {flaggedDrafts.map(d => (
                <FlaggedDraftCard key={d.id} draft={d} onAction={fetchData} userId={session?.user?.id} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
