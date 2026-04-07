import useStaffData from '../hooks/tower/useStaffData'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const ROLE_LABELS = {
  senior_walker: 'Wiggle Pro',
  junior_walker: 'Pup Walker',
}

function SectorBadge({ sector }) {
  if (sector === 'Plateau')
    return <span style={{ fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-plateau-blue)' }}>Plateau</span>
  if (sector === 'Laurier')
    return <span style={{ fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-laurier-green)' }}>Laurier</span>
  if (sector === 'both')
    return <span style={{ fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-purple)' }}>Both</span>
  return null
}

function DayPill({ sector }) {
  if (sector === 'Plateau')
    return <span style={{ background: 'var(--tower-plateau-blue-light)', color: 'var(--tower-plateau-blue)', fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', borderRadius: 20, padding: '2px 10px' }}>Plateau</span>
  if (sector === 'Laurier')
    return <span style={{ background: 'var(--tower-laurier-green-light)', color: 'var(--tower-laurier-green)', fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', borderRadius: 20, padding: '2px 10px' }}>Laurier</span>
  if (sector === 'both')
    return <span style={{ background: 'var(--tower-purple-light)', color: 'var(--tower-purple)', fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', borderRadius: 20, padding: '2px 10px' }}>Both</span>
  return null
}

function parseSchedule(schedule) {
  if (!schedule) return new Set()
  return new Set(schedule.split(',').map((s) => s.trim()))
}

export default function TowerStaff() {
  const { staff, loading, error } = useStaffData()

  return (
    <div className="px-6 py-6" style={{ fontFamily: 'var(--tower-font)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5" style={{ height: 56 }}>
        <h1 style={{ fontSize: 'var(--tower-text-xl)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-text-primary)', margin: 0 }}>
          Staff
        </h1>
        <span style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
          {staff.length} walker{staff.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>Loading&hellip;</p>
      ) : error ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-coral)' }}>{error}</p>
      ) : (
        <>
          <div style={{ background: 'var(--tower-bg-surface)', border: '1px solid var(--tower-border-default)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(5, 1fr)' }}>
              {/* Header row */}
              <div style={{
                background: 'var(--tower-bg-surface-alt)',
                borderBottom: '1px solid var(--tower-border-default)',
                borderRight: '1px solid var(--tower-border-default)',
                padding: '10px 12px',
                fontSize: 'var(--tower-text-xs)',
                fontWeight: 'var(--tower-font-bold)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--tower-text-muted)',
              }}>
                Walker
              </div>
              {DAYS.map((day) => (
                <div
                  key={day}
                  style={{
                    background: 'var(--tower-bg-surface-alt)',
                    borderBottom: '1px solid var(--tower-border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 40,
                    fontSize: 'var(--tower-text-base)',
                    fontWeight: 'var(--tower-font-bold)',
                    color: 'var(--tower-text-muted)',
                  }}
                >
                  {day}
                </div>
              ))}

              {/* Walker rows */}
              {staff.map((walker, idx) => {
                const sched = parseSchedule(walker.schedule)
                const isLast = idx === staff.length - 1
                const borderB = isLast ? 'none' : '1px solid var(--tower-bg-surface-alt)'

                return [
                  <div
                    key={`${walker.email}-name`}
                    style={{
                      padding: '10px 12px',
                      borderBottom: borderB,
                      borderRight: '1px solid var(--tower-border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ fontSize: 'var(--tower-text-md)', fontWeight: 'var(--tower-font-semibold)', color: 'var(--tower-text-primary)' }}>
                      {walker.full_name}
                    </div>
                    <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 'var(--tower-text-xs)', color: 'var(--tower-text-muted)' }}>
                        {ROLE_LABELS[walker.role] || walker.role}
                      </span>
                      <SectorBadge sector={walker.sector} />
                    </div>
                  </div>,
                  ...DAYS.map((day) => (
                    <div
                      key={`${walker.email}-${day}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: borderB,
                        padding: '6px',
                      }}
                    >
                      {sched.has(day)
                        ? <DayPill sector={walker.sector} />
                        : <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-text-muted)' }}>{'\u2014'}</span>}
                    </div>
                  )),
                ]
              })}
            </div>
          </div>

          <p style={{
            fontSize: 'var(--tower-text-sm)',
            color: 'var(--tower-text-muted)',
            fontStyle: 'italic',
            textAlign: 'center',
            padding: '12px 0',
          }}>
            Walkers are scheduled in Wiggle HQ — contact Rod to update.
          </p>
        </>
      )}
    </div>
  )
}
