import { useAuth } from '../context/AuthContext'

const SECTOR_COLORS = {
  Plateau: 'bg-amber-100 text-amber-800',
  Laurier: 'bg-blue-100 text-blue-800',
  both: 'bg-purple-100 text-purple-800',
}

export default function Header({ date }) {
  const { profile, isAdmin, signOut } = useAuth()

  // Parse YYYY-MM-DD without UTC interpretation (new Date("2026-03-02") would
  // be UTC midnight, which shows as the previous day in America/Toronto)
  const displayDate = (() => {
    const dateStr = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  })()

  const sector = profile?.sector || 'both'
  const sectorLabel = sector === 'both' ? 'All Sectors' : sector
  const sectorColor = SECTOR_COLORS[sector] || SECTOR_COLORS.both

  return (
    <header className="bg-white shadow-sm sticky top-0 z-30">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center">
            {/* Dog silhouette SVG placeholder */}
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <ellipse cx="12" cy="22" rx="8" ry="5" fill="#1A1A1A"/>
              <circle cx="20" cy="14" r="6" fill="#1A1A1A"/>
              <ellipse cx="10" cy="18" rx="3" ry="5" fill="#1A1A1A" transform="rotate(-20 10 18)"/>
              <ellipse cx="26" cy="20" rx="2" ry="6" fill="#1A1A1A" transform="rotate(15 26 20)"/>
              <ellipse cx="25" cy="9" rx="2" ry="4" fill="#1A1A1A" transform="rotate(-10 25 9)"/>
            </svg>
          </div>
          <div className="leading-tight">
            <span className="text-[#E8634A] font-bold text-lg tracking-tight">WIGGLE</span>
            <span className="text-[#1A1A1A] font-medium text-sm block -mt-1">Dog Walks</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <a
              href="/admin"
              className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium"
            >
              Admin
            </a>
          )}
          <button
            onClick={signOut}
            className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium active:bg-gray-200"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Date + sector bar */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">{displayDate}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sectorColor}`}>
          {sectorLabel}
        </span>
      </div>
    </header>
  )
}
