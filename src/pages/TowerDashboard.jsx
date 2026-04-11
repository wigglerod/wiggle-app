import { useState, useCallback } from 'react'
import useMiniGenResults from '../hooks/tower/useMiniGenResults'
import useWalkerFlags from '../hooks/tower/useWalkerFlags'
import DashboardLeftColumn from '../components/tower/dashboard/DashboardLeftColumn'
import DashboardRightColumn from '../components/tower/dashboard/DashboardRightColumn'

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
  const { drafts, miniGenFlags, stats, loading, refetch } = useMiniGenResults()
  const {
    walkerFlags, loading: walkerFlagsLoading,
    error: walkerFlagsError, refetch: refetchWalkerFlags, resolveFlag,
  } = useWalkerFlags()

  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)

  // Optimistic resolve: remove row from list immediately, then persist
  const [optimisticHidden, setOptimisticHidden] = useState(new Set())

  const handleResolveFlag = useCallback(async (noteId) => {
    // Optimistic: hide immediately
    setOptimisticHidden(prev => new Set(prev).add(noteId))
    try {
      await resolveFlag(noteId)
      refetchWalkerFlags()
    } catch (err) {
      // Revert optimistic hide
      setOptimisticHidden(prev => {
        const next = new Set(prev)
        next.delete(noteId)
        return next
      })
      throw err
    }
  }, [resolveFlag, refetchWalkerFlags])

  const visibleWalkerFlags = walkerFlags.filter(f => !optimisticHidden.has(f.id))

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

      {/* ── 2. TWO-COLUMN LAYOUT ── */}
      <div className="flex flex-col lg:grid lg:grid-cols-[320px_1fr] lg:gap-8">
        <DashboardLeftColumn
          walkerFlags={visibleWalkerFlags}
          walkerFlagsLoading={walkerFlagsLoading}
          walkerFlagsError={walkerFlagsError}
          onResolveFlag={handleResolveFlag}
        />
        <DashboardRightColumn
          stats={stats}
          drafts={drafts}
          miniGenFlags={miniGenFlags}
          loading={loading}
          onAction={refetch}
          runMiniGen={runMiniGen}
          running={running}
          runError={runError}
        />
      </div>
    </div>
  )
}
