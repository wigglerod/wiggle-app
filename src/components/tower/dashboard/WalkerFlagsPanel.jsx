import { useState } from 'react'
import { towerCard, towerSectionLabel } from '../tower-utils'

function fmtTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function FlagRow({ flag, onDone }) {
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  async function handleDone() {
    setBusy(true)
    setErrMsg(null)
    try {
      await onDone(flag.id)
    } catch {
      setErrMsg('Failed to resolve')
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        ...towerCard,
        padding: '10px 14px',
        borderLeft: '4px solid var(--tower-coral)',
        borderRadius: '0 10px 10px 0',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontSize: 'var(--tower-text-md)',
            fontWeight: 'var(--tower-font-bold)',
            color: 'var(--tower-text-primary)',
          }}
        >
          {flag.dog_name}
        </span>
        <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-text-muted)' }}>
          {fmtTime(flag.created_at)}
        </span>
      </div>

      <p style={{
        margin: '0 0 2px',
        fontSize: 'var(--tower-text-sm)',
        color: 'var(--tower-purple)',
        fontWeight: 'var(--tower-font-semibold)',
      }}>
        {flag.walker_name}
      </p>

      {flag.message && (
        <p style={{
          margin: '4px 0 0',
          fontSize: 'var(--tower-text-base)',
          color: 'var(--tower-text-secondary)',
          lineHeight: 1.4,
        }}>
          {flag.message}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        {errMsg && (
          <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-coral)' }}>
            {errMsg}
          </span>
        )}
        {!errMsg && <span />}
        <button
          onClick={handleDone}
          disabled={busy}
          style={{
            background: 'var(--tower-sage)',
            color: 'var(--tower-text-inverse)',
            fontSize: 'var(--tower-text-sm)',
            fontWeight: 'var(--tower-font-bold)',
            borderRadius: 6,
            padding: '4px 12px',
            border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            fontFamily: 'var(--tower-font)',
          }}
        >
          {busy ? '…' : 'Done'}
        </button>
      </div>
    </div>
  )
}

export default function WalkerFlagsPanel({ walkerFlags, loading, error, onResolve }) {
  const count = walkerFlags.length

  return (
    <div>
      <h2 className="mb-3" style={towerSectionLabel}>
        🚩 Walker Flags{count > 0 ? ` · ${count}` : ''}
      </h2>

      {loading ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
          Loading…
        </p>
      ) : error ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-coral)' }}>
          {error}
        </p>
      ) : count === 0 ? (
        <p
          style={{
            fontSize: 'var(--tower-text-md)',
            color: 'var(--tower-text-muted)',
            fontStyle: 'italic',
            textAlign: 'center',
            padding: '32px 0',
          }}
        >
          No walker flags today.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {walkerFlags.map(f => (
            <FlagRow key={f.id} flag={f} onDone={onResolve} />
          ))}
        </div>
      )}
    </div>
  )
}
