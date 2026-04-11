import StatsBar from './StatsBar'
import DraftCard from './DraftCard'
import FlagCard from './FlagCard'
import BeastSection from '../beast/BeastSection'
import { towerSectionLabel } from '../tower-utils'

export default function DashboardRightColumn({
  stats,
  drafts,
  miniGenFlags,
  loading,
  onAction,
  runMiniGen,
  running,
  runError,
}) {
  return (
    <div>
      {/* Stats */}
      <div className="mb-6">
        <StatsBar stats={stats} />
      </div>

      {/* Drafts */}
      <div className="mb-8">
        <h2 className="mb-3" style={towerSectionLabel}>
          📋 This week&rsquo;s drafts
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
              <DraftCard key={d.id} draft={d} miniGenFlags={miniGenFlags} onAction={onAction} />
            ))}
          </div>
        )}
      </div>

      {/* Mini Gen Flags */}
      <div className="mb-8">
        <h2 className="mb-3" style={towerSectionLabel}>
          ⚙️ Mini Gen flags
        </h2>

        {loading ? (
          <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
            Loading&hellip;
          </p>
        ) : miniGenFlags.length === 0 ? (
          <p
            style={{
              fontSize: 'var(--tower-text-md)',
              color: 'var(--tower-sage)',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            &check; No Mini Gen flags this week.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {miniGenFlags.map((f) => (
              <FlagCard key={f.id} flag={f} />
            ))}
          </div>
        )}
      </div>

      {/* Beast */}
      <BeastSection />
    </div>
  )
}
