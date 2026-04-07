import { useState } from 'react'

export default function BeastConfirm({ action, onConfirm, onCancel }) {
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div
        className="mt-1.5 px-3 py-2"
        style={{
          fontSize: 'var(--tower-text-base)',
          color: 'var(--tower-sage)',
          fontFamily: 'var(--tower-font)',
          fontWeight: 'var(--tower-font-semibold)',
        }}
      >
        {'\u2713'} Logged — Beast flagged this for follow-up
      </div>
    )
  }

  return (
    <div
      className="mt-1.5"
      style={{
        background: 'var(--tower-yellow-light)',
        border: '1px solid var(--tower-yellow)',
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: 'var(--tower-font)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--tower-text-xs)',
          fontWeight: 'var(--tower-font-bold)',
          textTransform: 'uppercase',
          color: 'var(--tower-text-muted)',
          marginBottom: 4,
        }}
      >
        Confirm action:
      </div>
      <p
        style={{
          fontSize: 'var(--tower-text-base)',
          color: 'var(--tower-text-primary)',
          fontStyle: 'italic',
          margin: '0 0 8px',
        }}
      >
        {action}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => { setDone(true); onConfirm?.() }}
          style={{
            background: 'var(--tower-orange)',
            color: 'var(--tower-text-inverse)',
            fontSize: 'var(--tower-text-base)',
            fontWeight: 'var(--tower-font-bold)',
            borderRadius: 6,
            padding: '6px 14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {'\ud83e\udda7'} Do it
        </button>
        <button
          onClick={onCancel}
          style={{
            background: 'var(--tower-bg-surface-alt)',
            color: 'var(--tower-text-secondary)',
            fontSize: 'var(--tower-text-base)',
            fontWeight: 'var(--tower-font-bold)',
            borderRadius: 6,
            padding: '6px 14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {'\u2715'} Nah
        </button>
      </div>
    </div>
  )
}
