const TABS = [
  { id: 'organizer', label: 'Organizer', icon: '📋' },
  { id: 'map', label: 'Map', icon: '🗺️' },
]

export default function BottomTabs({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg pb-[env(safe-area-inset-bottom)]">
      <div className="flex max-w-lg mx-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all ${
              active === tab.id
                ? 'text-[#E8634A]'
                : 'text-gray-400'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-xs font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
