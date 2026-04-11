import { useState } from 'react'
import { towerCard, sectorColor } from '../tower-utils'

function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default function DraftCard({ draft, miniGenFlags, onAction }) {
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null) // 'approved' | 'rejected'

  const dogs = draft.dog_names || []
  const dayFlags = (miniGenFlags || []).filter((f) => f.walk_date === draft.walk_date)
  const hasFlags = dayFlags.length > 0

  async function handleAction(status) {
    setBusy(status)
    try {
      const res = await fetch('/api/tower-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, status }),
      })
      if (!res.ok) throw new Error(await res.text())
      setResult(status === 'approved' ? 'approved' : 'rejected')
      setTimeout(() => onAction?.(), 1500)
    } catch {
      setBusy(null)
    }
  }

  if (result) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          ...towerCard,
          borderBottom: '2.5px solid var(--tower-border-strong)',
          padding: '14px 16px',
          minHeight: 80,
          color: result === 'approved'
            ? 'var(--tower-sage)'
            : 'var(--tower-amber)',
          fontSize: 'var(--tower-text-md)',
          fontWeight: 'var(--tower-font-bold)',
          fontFamily: 'var(--tower-font)',
        }}
      >
        {result === 'approved' ? 'Approved \u2713' : 'Rejected'}
      </div>
    )
  }

  return (
    <div
      style={{
        ...towerCard,
        borderBottom: '2.5px solid var(--tower-border-strong)',
        padding: '14px 16px',
        fontFamily: 'var(--tower-font)',
      }}
    >
      {/* Header: date + sector + actions */}
      <div className="flex items-center justify-between mb-2">
        <span
          style={{
            fontSize: 'var(--tower-text-md)',
            fontWeight: 'var(--tower-font-bold)',
            color: sectorColor(draft.sector),
          }}
        >
          {fmtDate(draft.walk_date)} &middot; {draft.sector.toUpperCase()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('approved')}
            disabled={!!busy}
            style={{
              background: 'var(--tower-sage)',
              color: 'var(--tower-text-inverse)',
              fontSize: 'var(--tower-text-xs)',
              fontWeight: 'var(--tower-font-bold)',
              borderRadius: 6,
              padding: '4px 10px',
              border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy === 'approved' ? '\u2026' : 'Approve'}
          </button>
          <button
            onClick={() => handleAction('rejected')}
            disabled={!!busy}
            style={{
              background: 'var(--tower-amber)',
              color: 'var(--tower-text-inverse)',
              fontSize: 'var(--tower-text-xs)',
              fontWeight: 'var(--tower-font-bold)',
              borderRadius: 6,
              padding: '4px 10px',
              border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy === 'rejected' ? '\u2026' : 'Reject'}
          </button>
        </div>
      </div>

      {/* Dog names */}
      <p
        className="mb-2"
        style={{
          fontSize: 'var(--tower-text-base)',
          color: 'var(--tower-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        {dogs.join(' \u00b7 ')}
      </p>

      {/* Footer: flag indicator + dog count */}
      <div className="flex items-center justify-between">
        {hasFlags ? (
          <span
            style={{
              fontSize: 'var(--tower-text-sm)',
              fontWeight: 'var(--tower-font-bold)',
              color: 'var(--tower-amber)',
            }}
          >
            \u26a0 {dayFlags.length} flag{dayFlags.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-sage)' }}>
            \u2713 No flags for this day
          </span>
        )}
        <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-text-muted)' }}>
          {dogs.length} dog{dogs.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
