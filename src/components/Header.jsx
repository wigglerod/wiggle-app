import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { roleLabel, roleColor } from '../lib/roles'
import OwlQuickDrawer, { useOwlNoteCount } from './OwlQuickDrawer'

const SECTOR_COLORS = {
  Plateau: 'bg-blue-100 text-blue-700',
  Laurier: 'bg-[#FDEBE7] text-[#E8634A]',
  both: 'bg-purple-100 text-purple-700',
}

export default function Header({ date }) {
  const { profile, isAdmin, isChiefPup, signOut } = useAuth()
  const [owlOpen, setOwlOpen] = useState(false)
  const owlCount = useOwlNoteCount()

  const displayDate = date ? (() => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  })() : null

  const sector = profile?.sector || 'both'
  const sectorLabel = sector === 'both' ? 'All Sectors' : sector
  const sectorColor = SECTOR_COLORS[sector] || SECTOR_COLORS.both

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
          <img
            src="/WiggleLogo.png"
            alt="Wiggle Dog Walks"
            className="h-8 w-auto object-contain"
          />
          <div className="flex items-center gap-2">
            {profile?.role && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${roleColor(profile.role)}`}>
                {roleLabel(profile.role)}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={() => setOwlOpen(true)}
                className="relative text-base px-2 py-1 rounded-full bg-gray-100 active:bg-gray-200 min-h-[32px] flex items-center"
              >
                <span className={owlCount > 0 ? 'owl-bounce' : ''}>🦉</span>
                {owlCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[#E8634A] text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {owlCount}
                  </span>
                )}
              </button>
            )}
            {isChiefPup && (
              <a
                href="/admin"
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium min-h-[32px] flex items-center"
              >
                Admin
              </a>
            )}
            <button
              onClick={signOut}
              className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium active:bg-gray-200 min-h-[32px]"
            >
              Sign out
            </button>
          </div>
        </div>

        {date && (
          <div className="px-4 pb-3 flex items-center justify-between max-w-lg mx-auto">
            <p className="text-sm text-gray-500 font-medium">{displayDate}</p>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${sectorColor}`}>
              {sectorLabel}
            </span>
          </div>
        )}
      </header>

      {isAdmin && <OwlQuickDrawer open={owlOpen} onClose={() => setOwlOpen(false)} />}
    </>
  )
}
