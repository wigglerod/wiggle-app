export default function StatsBar({ stats }) {
  const { pendingDrafts, flagCount, lastRunDate } = stats

  const fmtDate = (d) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const chips = [
    {
      label: `${pendingDrafts} draft${pendingDrafts !== 1 ? 's' : ''} pending`,
      active: pendingDrafts > 0,
      colors: pendingDrafts > 0
        ? { bg: 'var(--tower-amber-light)', border: 'var(--tower-amber)', color: 'var(--tower-amber)' }
        : { bg: 'var(--tower-sage-light)', border: 'var(--tower-sage)', color: 'var(--tower-sage)' },
    },
    {
      label: flagCount > 0
        ? `${flagCount} flag${flagCount !== 1 ? 's' : ''}`
        : '\u2713 No flags',
      active: flagCount > 0,
      colors: flagCount > 0
        ? { bg: 'var(--tower-coral-light)', border: 'var(--tower-coral)', color: 'var(--tower-coral)' }
        : { bg: 'var(--tower-sage-light)', border: 'var(--tower-sage)', color: 'var(--tower-sage)' },
    },
    {
      label: lastRunDate ? `Last run: ${fmtDate(lastRunDate)}` : "Mini Gen hasn't run yet",
      active: false,
      colors: { bg: 'var(--tower-bg-surface-alt)', border: 'var(--tower-border-default)', color: 'var(--tower-text-muted)' },
    },
  ]

  return (
    <div className="flex gap-3">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center"
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            border: `1px solid ${chip.colors.border}`,
            background: chip.colors.bg,
            color: chip.colors.color,
            fontSize: 'var(--tower-text-base)',
            fontWeight: 'var(--tower-font-semibold)',
            fontFamily: 'var(--tower-font)',
          }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  )
}
