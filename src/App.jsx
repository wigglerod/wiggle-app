import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Admin from './pages/Admin'
import DogsPage from './pages/DogsPage'
import SettingsPage from './pages/SettingsPage'
import LoadingDog from './components/LoadingDog'

function ProtectedRoute({ children }) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF4F1] flex items-center justify-center">
        <LoadingDog />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF4F1] flex items-center justify-center">
        <LoadingDog />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <Schedule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dogs"
        element={
          <ProtectedRoute>
            <DogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
