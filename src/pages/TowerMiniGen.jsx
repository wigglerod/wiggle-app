import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

/* ── helpers ────────────────────────────────────────── */

function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/* ── sub-components ─────────────────────────────────── */

function DogChip({ name }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-[10px] text-[10px] font-medium border"
      style={{
        background: '#F0ECE8',
        borderColor: '#E8E4E0',
        color: '#534AB7',
      }}
    >
      {name}
    </span>
  )
}

function DraftCard({ draft, onAction }) {
  const [busy, setBusy] = useState(null) // 'approve' | 'reject'
  const sectorColor = draft.sector === 'Plateau' ? '#3B82A0' : '#4A9E6F'
  const dogs = draft.dog_names || []
  const flags = draft.flags || []
  const hasFlags = Array.isArray(flags) && flags.length > 0

  async function handleAction(action) {
    setBusy(action)
    try {
      const res = await fetch('/api/tower-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, status: action === 'approve' ? 'approved' : 'rejected' }),
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
      {/* header row */}
      <div className="flex items-center justify-between mb-2">
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

      {/* dog chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {dogs.map((name) => (
          <DogChip key={name} name={name} />
        ))}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between">
        {hasFlags ? (
          <span className="text-[11px] font-bold" style={{ color: '#C4851C' }}>
            ⚠ {flags.length} flag{flags.length !== 1 ? 's' : ''} — see below
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: '#2D8F6F' }}>
            ✓ No flags for this day
          </span>
        )}
        <span className="text-[11px]" style={{ color: '#8C857E' }}>
          {dogs.length} dog{dogs.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

function FlagCard({ flag }) {
  const tags = flag.tags || []
  let borderColor = '#475569'
  let bg = '#F0ECE8'

  if (tags.includes('conflict'))   { borderColor = '#E8634A'; bg = '#FAECE7' }
  if (tags.includes('vacation'))   { borderColor = '#C4851C'; bg = '#FDF3E3' }
  if (tags.includes('capacity'))   { borderColor = '#534AB7'; bg = '#EEEDFE' }
  if (tags.includes('unresolved')) { borderColor = '#475569'; bg = '#F0ECE8' }

  return (
    <div
      className="p-3 rounded-lg"
      style={{
        background: bg,
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-bold" style={{ color: '#534AB7', fontFamily: 'DM Sans, sans-serif' }}>
          {flag.dog_name}
        </span>
        <span className="text-[11px]" style={{ color: '#8C857E' }}>
          {fmtDate(flag.walk_date)}
        </span>
      </div>
      <p className="text-[12px]" style={{ color: '#5A6270', fontFamily: 'DM Mono, monospace' }}>
        {flag.message}
      </p>
    </div>
  )
}

/* ── main page ──────────────────────────────────────── */

export default function TowerMiniGen() {
  const { profile, isLoading: authLoading } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [flags, setFlags] = useState([])
  const [statusLine, setStatusLine] = useState(null)
  const [running, setRunning] = useState(false)
  const [runSummary, setRunSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  /* ── data fetch ─── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // drafts
      const { data: draftRows } = await supabase
        .from('mini_gen_drafts')
        .select('*')
        .eq('status', 'pending')
        .order('walk_date')
        .order('sector')

      setDrafts(draftRows || [])

      // status bar — latest run_date
      if (draftRows && draftRows.length > 0) {
        const latest = draftRows[0]
        setStatusLine(`Last run: ${fmtDate(latest.run_date || latest.walk_date)} · ${draftRows.length} draft day${draftRows.length !== 1 ? 's' : ''} pending`)
      } else {
        setStatusLine(null)
      }

      // flags
      const minWalkDate = draftRows && draftRows.length > 0
        ? draftRows.reduce((m, d) => (d.walk_date < m ? d.walk_date : m), draftRows[0].walk_date)
        : null

      if (minWalkDate) {
        const { data: flagRows } = await supabase
          .from('walker_notes')
          .select('dog_name, message, walk_date, tags, created_at')
          .eq('note_type', 'resolver_flag')
          .gte('walk_date', minWalkDate)
          .order('walk_date')
          .order('tags')

        setFlags(flagRows || [])
      } else {
        setFlags([])
      }
    } catch (e) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── run Mini Gen ── */
  async function runMiniGen() {
    setRunning(true)
    setRunSummary(null)
    try {
      const res = await fetch('/api/mini-gen', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setRunSummary(
        `Last run: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · ` +
        `${json.resolved ?? '?'} resolved · ${json.unresolved ?? 0} unresolved · ` +
        `${json.conflicts ?? 0} conflict${(json.conflicts ?? 0) !== 1 ? 's' : ''} · ` +
        `${json.vacationConflicts ?? 0} vacation conflict${(json.vacationConflicts ?? 0) !== 1 ? 's' : ''}`
      )
      await fetchData()
      toast.success('Mini Gen complete')
    } catch (e) {
      toast.error(e.message || 'Mini Gen failed')
    } finally {
      setRunning(false)
    }
  }

  /* ── auth guard ── */
  if (authLoading) return null
  if (!profile || profile.role !== 'admin') return <Navigate to="/login" replace />

  /* ── layout ── */
  return (
    <div className="min-h-screen" style={{ background: '#FFF5F0', fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── 1. HEADER BAR ── */}
      <header
        className="flex items-center justify-between px-5"
        style={{ background: '#2D2926', height: 56 }}
      >
        <span className="text-[16px] font-bold" style={{ color: '#E8634A' }}>
          🐾 Tower Control
        </span>
        <button
          onClick={runMiniGen}
          disabled={running}
          className="px-4 py-2 rounded-lg text-[13px] font-bold text-white disabled:opacity-60"
          style={{ background: '#E8762B' }}
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
            '🦍 Run Mini Gen'
          )}
        </button>
      </header>

      {/* ── run summary (appears after Run) ── */}
      {runSummary && (
        <div
          className="px-5 py-2 text-[12px]"
          style={{ background: '#FAF7F4', borderBottom: '1px solid #E8E4E0', color: '#475569' }}
        >
          {runSummary}
        </div>
      )}

      {/* ── 2. STATUS BAR ── */}
      <div
        className="px-5 py-3 text-[12px]"
        style={{ background: '#FAF7F4', borderBottom: '1px solid #E8E4E0', color: '#475569' }}
      >
        {loading ? 'Loading…' : statusLine || "Mini Gen hasn't run yet. Press Run Mini Gen to start."}
      </div>

      {/* ── main content ── */}
      <div className="max-w-5xl mx-auto px-5 py-6">

        {/* ── 3. DRAFT TABLE ── */}
        <section className="mb-8">
          <h2
            className="text-[10px] font-bold uppercase tracking-wider mb-3"
            style={{ color: '#E8634A' }}
          >
            📋 MINI GEN DRAFT
          </h2>

          {drafts.length === 0 && !loading ? (
            <p className="text-[13px] italic text-center py-8" style={{ color: '#8C857E' }}>
              No pending drafts. Run Mini Gen to generate this week's schedule.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drafts.map((d) => (
                <DraftCard key={d.id} draft={d} onAction={fetchData} />
              ))}
            </div>
          )}
        </section>

        {/* ── 4. FLAG LIST ── */}
        <section>
          <h2
            className="text-[10px] font-bold uppercase tracking-wider mb-3"
            style={{ color: '#E8634A' }}
          >
            🚩 FLAGS
          </h2>

          {flags.length === 0 ? (
            <p className="text-[13px] italic text-center py-8" style={{ color: '#2D8F6F' }}>
              ✓ Mini Gen found no issues this week.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {flags.map((f) => (
                <FlagCard key={f.id || `${f.dog_name}-${f.walk_date}`} flag={f} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
