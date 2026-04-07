import useWeeklyData from '../hooks/tower/useWeeklyData'
import WeeklyGrid from '../components/tower/weekly/WeeklyGrid'

export default function TowerWeekly() {
  const { days, weekLabel, loading, error } = useWeeklyData()

  // Totals
  const plateauCount = days.reduce((n, d) => n + (d.plateau?.dog_names?.length || 0), 0)
  const laurierCount = days.reduce((n, d) => n + (d.laurier?.dog_names?.length || 0), 0)
  const totalCount = plateauCount + laurierCount

  return (
    <div className="px-6 py-6" style={{ fontFamily: 'var(--tower-font)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5" style={{ height: 56 }}>
        <h1
          style={{
            fontSize: 'var(--tower-text-xl)',
            fontWeight: 'var(--tower-font-bold)',
            color: 'var(--tower-text-primary)',
            margin: 0,
          }}
        >
          Weekly Board
        </h1>
        <span style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
          {weekLabel}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
          Loading&hellip;
        </p>
      ) : error ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-coral)' }}>
          {error}
        </p>
      ) : (
        <>
          <WeeklyGrid days={days} />

          {/* Summary */}
          <p
            style={{
              fontSize: 'var(--tower-text-base)',
              color: 'var(--tower-text-muted)',
              textAlign: 'center',
              paddingTop: 16,
            }}
          >
            {totalCount} dog{totalCount !== 1 ? 's' : ''} this week
            {' \u00b7 '}
            <span style={{ color: 'var(--tower-plateau-blue)' }}>{plateauCount} Plateau</span>
            {' \u00b7 '}
            <span style={{ color: 'var(--tower-laurier-green)' }}>{laurierCount} Laurier</span>
          </p>
        </>
      )}
    </div>
  )
}
