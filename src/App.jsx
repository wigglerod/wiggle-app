import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LoadingDog from './components/LoadingDog'
import OfflineBanner from './components/OfflineBanner'
import UpdateBanner from './components/UpdateBanner'

const Admin = lazy(() => import('./pages/Admin'))
const DogsPage = lazy(() => import('./pages/DogsPage'))
const Schedule = lazy(() => import('./pages/Schedule'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const Tower = lazy(() => import('./pages/Tower'))
const TowerMiniGen = lazy(() => import('./pages/TowerMiniGen'))

function LazyFallback() {
  return (
    <div className="min-h-screen bg-[#FFF4F1] flex items-center justify-center">
      <LoadingDog />
    </div>
  )
}

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
  const { permissions, isLoading } = useAuth()
  if (isLoading) return null
  if (!permissions?.canAccessAdmin) return <Navigate to="/" replace />
  return children
}

function SettingsRoute({ children }) {
  const { permissions, isLoading } = useAuth()
  if (isLoading) return null
  if (!permissions?.canAccessSettings) return <Navigate to="/" replace />
  return children
}

function TowerRoute({ children }) {
  const { permissions, profile, isLoading, session } = useAuth()
  if (isLoading || (session && !profile)) return null
  if (!permissions?.canAccessTower) return <Navigate to="/" replace />
  return children
}

// Page transition variants — crossfade 200ms
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

function AnimatedRoutes() {
  const location = useLocation()
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF4F1] flex items-center justify-center">
        <LoadingDog />
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2 }}
      >
        <Routes location={location}>
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
                <Suspense fallback={<LazyFallback />}>
                  <Schedule />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <Suspense fallback={<LazyFallback />}>
                    <Admin />
                  </Suspense>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dogs"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LazyFallback />}>
                  <DogsPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsRoute>
                  <Suspense fallback={<LazyFallback />}>
                    <SettingsPage />
                  </Suspense>
                </SettingsRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tower/mini-gen"
            element={
              <ProtectedRoute>
                <TowerRoute>
                  <Suspense fallback={<LazyFallback />}>
                    <TowerMiniGen />
                  </Suspense>
                </TowerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tower/*"
            element={
              <ProtectedRoute>
                <TowerRoute>
                  <Suspense fallback={<LazyFallback />}>
                    <Tower />
                  </Suspense>
                </TowerRoute>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UpdateBanner />
      <AuthProvider>
        <OfflineBanner />
        <AnimatedRoutes />
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  )
}
