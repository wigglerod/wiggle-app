import useScheduleData from '../hooks/tower/useScheduleData'
import { towerCard, towerSectionLabel } from '../components/tower/tower-utils'

const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
})

function fmtExpiry(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isExpiringSoon(iso) {
  const exp = new Date(iso)
  const now = new Date()
  const diff = (exp - now) / (1000 * 60 * 60 * 24)
  return diff <= 2
}

function SectorBadge({ sector }) {
  if (sector === 'Plateau')
    return <span style={{ fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-plateau-blue)' }}>Plateau</span>
  if (sector === 'Laurier')
    return <span style={{ fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-laurier-green)' }}>Laurier</span>
  return null
}

function CountBadge({ count }) {
  const active = count > 0
  return (
    <span
      style={{
        fontSize: 'var(--tower-text-xs)',
        fontWeight: 'var(--tower-font-bold)',
        borderRadius: 20,
        padding: '2px 10px',
        background: active ? 'var(--tower-amber-light)' : 'var(--tower-sage-light)',
        color: active ? 'var(--tower-amber)' : 'var(--tower-sage)',
      }}
    >
      {count} active
    </span>
  )
}

function CardShell({ children }) {
  return (
    <div style={{ ...towerCard, borderBottom: '2.5px solid var(--tower-border-strong)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

/* ── Card A: Owl Notes ── */
function OwlNotesCard({ notes }) {
  return (
    <CardShell>
      <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--tower-border-default)' }}>
        <span style={{ ...towerSectionLabel, margin: 0 }}>{'\ud83e\udd89'} Active Owl Notes</span>
        <CountBadge count={notes.length} />
      </div>
      {notes.length === 0 ? (
        <p style={{ fontSize: 'var(--tower-text-base)', color: 'var(--tower-text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '24px 14px' }}>
          No active owl notes right now.
        </p>
      ) : (
        <div>
          {notes.map((n, i) => {
            const soon = isExpiringSoon(n.expires_at)
            return (
              <div
                key={n.id}
                style={{
                  padding: '10px 14px',
                  borderBottom: i < notes.length - 1 ? '1px solid var(--tower-bg-surface-alt)' : 'none',
                  fontFamily: 'var(--tower-font)',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFB' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 'var(--tower-text-md)', fontWeight: 'var(--tower-font-semibold)', color: 'var(--tower-purple)' }}>
                    {n.target_dog_name}
                  </span>
                  <SectorBadge sector={n.target_sector} />
                </div>
                <p style={{
                  fontSize: 'var(--tower-text-base)',
                  color: 'var(--tower-text-secondary)',
                  margin: '0 0 4px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {n.note_text}
                </p>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 'var(--tower-text-xs)', color: 'var(--tower-text-muted)' }}>
                    by {n.created_by_name}
                  </span>
                  <span style={{
                    fontSize: 'var(--tower-text-xs)',
                    color: soon ? 'var(--tower-coral)' : 'var(--tower-amber)',
                    fontWeight: 'var(--tower-font-bold)',
                  }}>
                    {soon ? '\u26a0 expires soon' : `expires ${fmtExpiry(n.expires_at)}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

/* ── Card B: Conflict Rules ── */
function ConflictsCard({ conflicts }) {
  return (
    <CardShell>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--tower-border-default)' }}>
        <span style={{ ...towerSectionLabel, margin: 0 }}>{'\u26a0'} Conflict Rules</span>
      </div>
      {conflicts.length === 0 ? (
        <p style={{ fontSize: 'var(--tower-text-base)', color: 'var(--tower-text-muted)', textAlign: 'center', padding: '24px 14px' }}>
          No conflict rules configured.
        </p>
      ) : (
        <div>
          {conflicts.map((c, i) => (
            <div
              key={c.id}
              style={{
                padding: '10px 14px',
                borderBottom: i < conflicts.length - 1 ? '1px solid var(--tower-bg-surface-alt)' : 'none',
                fontFamily: 'var(--tower-font)',
              }}
            >
              <div style={{ fontSize: 'var(--tower-text-md)', marginBottom: 2 }}>
                <span style={{ fontWeight: 'var(--tower-font-semibold)', color: 'var(--tower-purple)' }}>{c.dog_1_name}</span>
                <span style={{ color: 'var(--tower-text-muted)', margin: '0 6px' }}>{'\u2194'}</span>
                <span style={{ fontWeight: 'var(--tower-font-semibold)', color: 'var(--tower-purple)' }}>{c.dog_2_name}</span>
              </div>
              {c.reason && (
                <p style={{ fontSize: 'var(--tower-text-base)', color: 'var(--tower-text-secondary)', margin: '0 0 2px' }}>
                  {c.reason}
                </p>
              )}
              <span style={{ fontSize: 'var(--tower-text-xs)', color: 'var(--tower-text-muted)' }}>
                Added {fmtExpiry(c.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

/* ── Card C: Sector Overrides ── */
function AltAddressesCard({ addresses }) {
  return (
    <CardShell>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--tower-border-default)' }}>
        <span style={{ ...towerSectionLabel, margin: 0 }}>{'\ud83d\udccd'} Sector Overrides</span>
      </div>
      {addresses.length === 0 ? (
        <p style={{ fontSize: 'var(--tower-text-base)', color: 'var(--tower-text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '24px 14px' }}>
          No alternate addresses configured yet.
        </p>
      ) : (
        <div>
          {addresses.map((a, i) => (
            <div
              key={a.id || i}
              style={{
                padding: '10px 14px',
                borderBottom: i < addresses.length - 1 ? '1px solid var(--tower-bg-surface-alt)' : 'none',
                fontFamily: 'var(--tower-font)',
                fontSize: 'var(--tower-text-base)',
                color: 'var(--tower-text-secondary)',
              }}
            >
              {a.dog_name && <span style={{ fontWeight: 'var(--tower-font-semibold)', color: 'var(--tower-purple)' }}>{a.dog_name}</span>}
              {a.address && <span> — {a.address}</span>}
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

/* ── Main Page ── */
export default function TowerSchedule() {
  const { owlNotes, conflicts, altAddresses, loading, error } = useScheduleData()

  return (
    <div className="px-6 py-6" style={{ fontFamily: 'var(--tower-font)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5" style={{ height: 56 }}>
        <h1 style={{ fontSize: 'var(--tower-text-xl)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-text-primary)', margin: 0 }}>
          Schedule
        </h1>
        <span style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
          {todayLabel}
        </span>
      </div>

      {loading ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>Loading&hellip;</p>
      ) : error ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-coral)' }}>{error}</p>
      ) : (
        <>
          {/* Two-column grid */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            <OwlNotesCard notes={owlNotes} />
            <ConflictsCard conflicts={conflicts} />
          </div>

          {/* Full-width card */}
          <AltAddressesCard addresses={altAddresses} />
        </>
      )}
    </div>
  )
}
