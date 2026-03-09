import { formatTime } from '../lib/parseICS'

export default function WalkCard({ group, loggedIds, onDogClick, onLogWalk, onStartRoute }) {
  const { startTime, endTime, events } = group
  const allLogged = events.every((ev) => loggedIds.has(ev._id))

  return (
    <div
      className={`rounded-2xl shadow-sm border p-4 transition-all ${
        allLogged
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-100'
      }`}
    >
      {/* Time row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🕙</span>
          <span className="font-semibold text-sm text-gray-700">
            {formatTime(startTime)} – {formatTime(endTime)}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {events.length} {events.length === 1 ? 'dog' : 'dogs'}
          </span>
        </div>
        {allLogged && (
          <span className="text-green-600 font-semibold text-sm flex items-center gap-1">
            ✅ Done
          </span>
        )}
      </div>

      {/* Sector badge if mixed */}
      {events.some((e) => e.sector !== events[0].sector) && (
        <div className="mb-2 flex gap-1 flex-wrap">
          {[...new Set(events.map((e) => e.sector))].map((s) => (
            <span key={s} className={`text-xs rounded-full px-2 py-0.5 font-medium ${
              s === 'Plateau' ? 'bg-blue-100 text-blue-700' : 'bg-[#FDEBE7] text-[#E8634A]'
            }`}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Dog chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {events.map((ev) => {
          const isLogged = loggedIds.has(ev._id)
          const isMissing = !ev.dog
          return (
            <button
              key={ev._id}
              onClick={() => onDogClick(ev)}
              className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition-all active:scale-95 min-h-[40px] ${
                isLogged
                  ? 'bg-green-100 text-green-700'
                  : isMissing
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-[#FFF4F1] text-[#E8634A] border border-[#f0c4b9]'
              }`}
            >
              {isMissing && <span>⚠️</span>}
              {ev.displayName}
              {isLogged && <span className="ml-1">✓</span>}
            </button>
          )
        })}
      </div>

      {/* Today's Notes from Acuity */}
      {events.filter((ev) => ev.clientNotes).map((ev) => (
        <div
          key={`note-${ev._id}`}
          className="rounded-xl border-2 border-[#E8634A]/30 bg-[#FFF4F1] px-3 py-2.5 mb-3"
        >
          <div className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0 mt-0.5">📝</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#E8634A] mb-0.5">
                Note from {ev.ownerName || ev.displayName}
              </p>
              <p className="text-sm text-gray-700 leading-snug">{ev.clientNotes}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Address preview (first event) */}
      {events[0]?.location && (
        <p className="text-xs text-gray-400 mb-3 truncate">
          📍 {events[0].location}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {/* Start Route button */}
        <button
          onClick={() => onStartRoute(group)}
          className="w-full py-3 rounded-full text-sm font-semibold border-2 border-[#E8634A] text-[#E8634A] transition-all active:scale-[0.98] active:bg-[#E8634A]/5 min-h-[48px]"
        >
          🗺️ Start Route
        </button>

        {/* Log walk button — all authenticated walkers can log */}
        <button
          onClick={() => onLogWalk(group)}
          className={`w-full py-3 rounded-full text-sm font-semibold transition-all active:scale-[0.98] min-h-[48px] ${
            allLogged
              ? 'bg-green-100 text-green-700 cursor-default'
              : 'bg-[#E8634A] text-white shadow-sm active:bg-[#d4552d]'
          }`}
          disabled={allLogged}
        >
          {allLogged ? '✅ Walk Logged' : '📝 Log Walk'}
        </button>
      </div>
    </div>
  )
}
