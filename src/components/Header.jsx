import { useAuth } from '../context/AuthContext'
import { roleLabel, roleColor } from '../lib/roles'

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
        <img
          src="/WiggleLogo.png"
          alt="Wiggle Dog Walks"
          className="h-8 w-auto object-contain"
        />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {profile?.role && (
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${roleColor(profile.role)}`}>
              {roleLabel(profile.role)}
            </span>
          )}
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
