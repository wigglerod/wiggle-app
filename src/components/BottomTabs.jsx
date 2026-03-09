import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const TABS = [
  {
    id: 'schedule',
    label: 'Schedule',
    paths: ['/', '/schedule'],
    navigate: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: 'dogs',
    label: 'Dogs',
    paths: ['/dogs'],
    navigate: '/dogs',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M4.5 11c.828 0 1.5-.895 1.5-2S5.328 7 4.5 7 3 7.895 3 9s.672 2 1.5 2zM9 9c.828 0 1.5-.895 1.5-2S9.828 5 9 5 7.5 5.895 7.5 7 8.172 9 9 9zm6 0c.828 0 1.5-.895 1.5-2S15.828 5 15 5s-1.5.895-1.5 2S14.172 9 15 9zm4.5 2c.828 0 1.5-.895 1.5-2s-.672-2-1.5-2S18 7.895 18 9s.672 2 1.5 2zM12 11c-2.5 0-7 1.5-7 4.5V17a1 1 0 001 1h12a1 1 0 001-1v-1.5C19 12.5 14.5 11 12 11z"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    paths: ['/settings'],
    navigate: '/settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

export default function BottomTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const activeId = TABS.find((t) => t.paths.includes(pathname))?.id ?? 'schedule'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-[0_-1px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.navigate)}
              className="relative flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2 min-h-[48px] transition-colors"
            >
              {/* Sliding coral bar */}
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute top-0 left-4 right-4 h-0.5 bg-[#E8634A] rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className={isActive ? 'text-[#E8634A]' : 'text-gray-400'}>
                {tab.icon}
              </span>
              <span className={`text-[11px] font-semibold tracking-tight ${isActive ? 'text-[#E8634A]' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
