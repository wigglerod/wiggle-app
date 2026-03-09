import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BottomTabs from '../components/BottomTabs'
import { roleLabel, roleColor } from '../lib/roles'

const SECTOR_COLORS = {
  Plateau: 'bg-blue-100 text-blue-700',
  Laurier:  'bg-[#FDEBE7] text-[#E8634A]',
  both:     'bg-purple-100 text-purple-700',
}

export default function SettingsPage() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const sector      = profile?.sector || 'both'
  const sectorLabel = sector === 'both' ? 'All Sectors' : sector
  const sectorColor = SECTOR_COLORS[sector] || SECTOR_COLORS.both

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#FFF4F1] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="px-4 py-4 max-w-lg mx-auto flex items-center justify-between">
          <img src="/WiggleLogo.png" alt="Wiggle" className="h-8 w-auto object-contain" />
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sectorColor}`}>
            {sectorLabel}
          </span>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FFF4F1] flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🐾</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1A1A1A] truncate">
                {profile?.full_name || user?.email || 'Walker'}
              </p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
              {profile?.role && (
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${roleColor(profile.role)}`}>
                  {roleLabel(profile.role)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Admin panel link */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors min-h-[56px]"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">⚙️</span>
                <div className="text-left">
                  <p className="font-semibold text-[#1A1A1A] text-sm">Admin Panel</p>
                  <p className="text-xs text-gray-400">Manage dogs, walkers &amp; logs</p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-400">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* Sign out */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-5 py-4 text-red-500 active:bg-red-50 transition-colors min-h-[56px]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="font-semibold text-sm">Sign Out</span>
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 pt-2">Wiggle Dog Walks · Montréal, QC</p>
      </main>

      <BottomTabs />
    </div>
  )
}
