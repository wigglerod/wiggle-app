import { useState } from 'react'
import useMiniGenResults from '../hooks/tower/useMiniGenResults'
import StatsBar from '../components/tower/dashboard/StatsBar'
import DraftCard from '../components/tower/dashboard/DraftCard'
import FlagCard from '../components/tower/dashboard/FlagCard'
import { towerSectionLabel } from '../components/tower/tower-utils'
import BeastSection from '../components/tower/beast/BeastSection'

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diffToMonday)
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { monday: fmt(mon), friday: fmt(fri) }
}

const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
})

export default function TowerDashboard() {
  const { drafts, flags, stats, loading, refetch } = useMiniGenResults()
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)

  async function runMiniGen() {
    setRunning(true)
    setRunError(null)
    try {
      const { monday, friday } = getWeekRange()
      const res = await fetch('/api/mini-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monday, friday }),
      })
      if (!res.ok) throw new Error(await res.text())
      await refetch()
    } catch {
      setRunError('Failed \u2014 check Vercel logs')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="px-6 py-6" style={{ fontFamily: 'var(--tower-font)' }}>

      {/* ── 1. PAGE HEADER ── */}
      <div className="flex items-center justify-between mb-5" style={{ height: 64 }}>
        <h1
          style={{
            fontSize: 'var(--tower-text-xl)',
            fontWeight: 'var(--tower-font-bold)',
            color: 'var(--tower-text-primary)',
            margin: 0,
          }}
        >
          Gen&rsquo;s Dashboard
        </h1>
        <div className="flex items-center gap-4">
          {runError && (
            <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-coral)' }}>
              {runError}
            </span>
          )}
          <span style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
            {todayLabel}
          </span>
          <button
            onClick={runMiniGen}
            disabled={running}
            style={{
              background: 'var(--tower-orange)',
              color: 'var(--tower-text-inverse)',
              fontSize: 'var(--tower-text-base)',
              fontWeight: 'var(--tower-font-bold)',
              borderRadius: 8,
              padding: '8px 16px',
              border: 'none',
              cursor: running ? 'not-allowed' : 'pointer',
              opacity: running ? 0.6 : 1,
            }}
          >
            {running ? 'Running\u2026' : '\ud83e\udda7 Run Mini Gen'}
          </button>
        </div>
      </div>

      {/* ── 2. STATS BAR ── */}
      <div className="mb-6">
        <StatsBar stats={stats} />
      </div>

      {/* ── 3. DRAFTS SECTION ── */}
      <div className="mb-8">
        <h2 className="mb-3" style={towerSectionLabel}>
          \ud83d\udccb THIS WEEK&rsquo;S DRAFTS
        </h2>

        {loading ? (
          <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
            Loading&hellip;
          </p>
        ) : drafts.length === 0 ? (
          <p
            style={{
              fontSize: 'var(--tower-text-md)',
              color: 'var(--tower-text-muted)',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            Mini Gen hasn&rsquo;t run yet. Use the button above to run it.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {drafts.map((d) => (
              <DraftCard key={d.id} draft={d} flags={flags} onAction={refetch} />
            ))}
          </div>
        )}
      </div>

      {/* ── 4. FLAGS SECTION ── */}
      <div>
        <h2 className="mb-3" style={towerSectionLabel}>
          \ud83d\udea9 FLAGS
        </h2>

        {loading ? (
          <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
            Loading&hellip;
          </p>
        ) : flags.length === 0 ? (
          <p
            style={{
              fontSize: 'var(--tower-text-md)',
              color: 'var(--tower-sage)',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            &check; No flags this week.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {flags.map((f) => (
              <FlagCard key={f.id} flag={f} />
            ))}
          </div>
        )}
      </div>

      {/* ── 5. BEAST SECTION ── */}
      <BeastSection />
    </div>
  )
}
