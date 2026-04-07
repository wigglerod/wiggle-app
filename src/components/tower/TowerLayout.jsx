import '../../styles/tower-tokens.css'
import TowerTabs from './TowerTabs'

export default function TowerLayout({ children }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--tower-bg-page)',
        fontFamily: 'var(--tower-font)',
      }}
    >
      <TowerTabs />
      <main className="max-w-[1440px] mx-auto">{children}</main>
    </div>
  )
}
