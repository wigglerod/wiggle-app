import { Routes, Route, Navigate } from 'react-router-dom'
import TowerLayout from '../components/tower/TowerLayout'
import TowerDashboard from './TowerDashboard'
import TowerWeekly from './TowerWeekly'
import TowerDogs from './TowerDogs'
import TowerStaff from './TowerStaff'
import TowerSchedule from './TowerSchedule'

function BillingComingSoon() {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'var(--tower-font)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{'\ud83d\udce6'}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tower-text-primary)', marginBottom: 8 }}>
        Billing coming soon
      </div>
      <div style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)', maxWidth: 360, margin: '0 auto' }}>
        Package tracking and billing history will appear here once
        the billing table is added to the database.
      </div>
    </div>
  )
}

export default function Tower() {
  return (
    <TowerLayout>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TowerDashboard />} />
        <Route path="weekly" element={<TowerWeekly />} />
        <Route path="schedule" element={<TowerSchedule />} />
        <Route path="dogs" element={<TowerDogs />} />
        <Route path="billing" element={<BillingComingSoon />} />
        <Route path="staff" element={<TowerStaff />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </TowerLayout>
  )
}
