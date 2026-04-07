import { NavLink } from 'react-router-dom'

const tabs = [
  { label: 'Dashboard', path: '/tower/dashboard' },
  { label: 'Weekly Board', path: '/tower/weekly' },
  { label: 'Schedule', path: '/tower/schedule' },
  { label: 'Dogs', path: '/tower/dogs' },
  { label: 'Billing', path: '/tower/billing' },
  { label: 'Staff', path: '/tower/staff' },
]

export default function TowerTabs() {
  return (
    <nav
      className="flex items-center px-5"
      style={{
        height: 44,
        background: 'var(--tower-bg-surface)',
        borderBottom: '1px solid var(--tower-border-default)',
        fontFamily: 'var(--tower-font)',
      }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          style={({ isActive }) => ({
            height: 44,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            fontSize: 'var(--tower-text-md)',
            fontWeight: 'var(--tower-font-semibold)',
            color: isActive
              ? 'var(--tower-text-primary)'
              : 'var(--tower-text-muted)',
            borderBottom: `2px solid ${isActive ? 'var(--tower-orange)' : 'transparent'}`,
            transition: 'color 150ms, border-color 150ms',
          })}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
