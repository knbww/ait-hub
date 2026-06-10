import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { ResearchPage } from './pages/ResearchPage'
import { NetworkPage } from './pages/NetworkPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminPage } from './pages/AdminPage'
import { RequireAuth } from './components/RequireAuth'
import { RequireRole } from './components/RequireRole'

export function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
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
    </AnimatePresence>
  )
}
