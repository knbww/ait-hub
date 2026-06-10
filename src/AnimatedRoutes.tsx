import { Suspense, lazy } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { RequireRole } from './components/RequireRole'

// Route-level code splitting: each page becomes its own lazily-loaded chunk.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const ResearchPage = lazy(() =>
  import('./pages/ResearchPage').then((m) => ({ default: m.ResearchPage })),
)
const NetworkPage = lazy(() =>
  import('./pages/NetworkPage').then((m) => ({ default: m.NetworkPage })),
)
const ResourcesPage = lazy(() =>
  import('./pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

function RouteFallback() {
  return <div className="max-w-7xl mx-auto text-center py-20 text-gray-500">Loading…</div>
}

export function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminPage />
              </RequireRole>
            }
          />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}
