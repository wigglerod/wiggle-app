function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function tagStyle(tags) {
  const t = tags || []
  if (t.includes('conflict'))   return { border: 'var(--tower-coral)',  bg: 'var(--tower-coral-light)' }
  if (t.includes('vacation'))   return { border: 'var(--tower-amber)',  bg: 'var(--tower-amber-light)' }
  if (t.includes('capacity'))   return { border: 'var(--tower-purple)', bg: 'var(--tower-purple-light)' }
  if (t.includes('unresolved')) return { border: 'var(--tower-slate)',  bg: 'var(--tower-bg-surface-alt)' }
  return { border: 'var(--tower-slate)', bg: 'var(--tower-bg-surface-alt)' }
}

export default function FlagCard({ flag }) {
  const { border, bg } = tagStyle(flag.tags)

  return (
    <div
      className="p-3"
      style={{
        background: bg,
        borderLeft: `4px solid ${border}`,
        borderRadius: '0 10px 10px 0',
        fontFamily: 'var(--tower-font)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontSize: 'var(--tower-text-md)',
            fontWeight: 'var(--tower-font-bold)',
            color: 'var(--tower-purple)',
          }}
        >
          {flag.dog_name}
        </span>
        <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-text-muted)' }}>
          {fmtDate(flag.walk_date)}
        </span>
      </div>
      <p style={{ fontSize: 'var(--tower-text-base)', color: 'var(--tower-text-secondary)', margin: 0 }}>
        {flag.message}
      </p>
    </div>
  )
}
