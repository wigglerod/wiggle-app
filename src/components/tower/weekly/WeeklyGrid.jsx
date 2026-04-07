import DogChip from './DogChip'

const today = new Date().toISOString().slice(0, 10)

function StatusBadge({ status }) {
  if (status === 'approved')
    return <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tower-sage)' }}>{'\u2713'}</span>
  if (status === 'pending')
    return <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tower-amber)', lineHeight: 1 }}>{'\u00b7'}</span>
  return null
}

function CellContent({ slot }) {
  if (!slot) {
    return (
      <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-text-muted)', fontStyle: 'italic' }}>
        —
      </span>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-1">
        <StatusBadge status={slot.status} />
      </div>
      <div className="flex flex-wrap">
        {slot.dog_names.map((name) => (
          <DogChip key={name} dogName={name} />
        ))}
      </div>
    </div>
  )
}

export default function WeeklyGrid({ days }) {
  const sectors = [
    { key: 'plateau', label: 'PLATEAU', color: 'var(--tower-plateau-blue)', bg: 'var(--tower-plateau-blue-light)', borderColor: '#3B82A0' },
    { key: 'laurier', label: 'LAURIER', color: 'var(--tower-laurier-green)', bg: 'var(--tower-laurier-green-light)', borderColor: '#4A9E6F' },
  ]

  return (
    <div
      style={{
        background: 'var(--tower-bg-surface)',
        border: '1px solid var(--tower-border-default)',
        borderRadius: 10,
        overflow: 'hidden',
        fontFamily: 'var(--tower-font)',
      }}
    >
      {/* Grid using CSS grid: 1 label col + 5 day cols */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(5, 1fr)' }}>

        {/* ── Header row ── */}
        <div style={{
          background: 'var(--tower-bg-surface-alt)',
          borderBottom: '1px solid var(--tower-border-default)',
          borderRight: '1px solid var(--tower-border-default)',
        }} />
        {days.map((day) => {
          const isToday = day.date === today
          return (
            <div
              key={day.date}
              style={{
                background: isToday ? 'var(--tower-bg-surface-hover)' : 'var(--tower-bg-surface-alt)',
                borderBottom: isToday
                  ? '2px solid var(--tower-orange)'
                  : '1px solid var(--tower-border-default)',
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--tower-text-base)',
                fontWeight: 'var(--tower-font-bold)',
                color: isToday ? 'var(--tower-text-primary)' : 'var(--tower-text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {day.label}
            </div>
          )
        })}

        {/* ── Sector rows ── */}
        {sectors.map((sector, sIdx) => {
          const isLast = sIdx === sectors.length - 1
          return days.map((day, dIdx) => {
            const isToday = day.date === today
            const slot = day[sector.key]

            // Sector label cell (only for first day column, spans via being placed at col 0)
            if (dIdx === 0) {
              return [
                <div
                  key={`${sector.key}-label`}
                  style={{
                    background: sector.bg,
                    borderRight: '1px solid var(--tower-border-default)',
                    borderBottom: isLast ? 'none' : '1px solid var(--tower-border-default)',
                    borderLeft: `3px solid ${sector.borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--tower-text-sm)',
                    fontWeight: 'var(--tower-font-bold)',
                    textTransform: 'uppercase',
                    color: sector.color,
                    padding: '12px 8px',
                  }}
                >
                  {sector.label}
                </div>,
                <div
                  key={`${sector.key}-${day.date}`}
                  style={{
                    padding: '10px 12px',
                    borderBottom: isLast ? 'none' : '1px solid var(--tower-border-default)',
                    background: isToday ? '#F8FAFB' : 'transparent',
                    verticalAlign: 'top',
                  }}
                >
                  <CellContent slot={slot} />
                </div>,
              ]
            }

            return (
              <div
                key={`${sector.key}-${day.date}`}
                style={{
                  padding: '10px 12px',
                  borderBottom: isLast ? 'none' : '1px solid var(--tower-border-default)',
                  background: isToday ? '#F8FAFB' : 'transparent',
                  verticalAlign: 'top',
                }}
              >
                <CellContent slot={slot} />
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}
