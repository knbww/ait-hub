import { Suspense, lazy } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { RequireRole } from './components/RequireRole'
import { useI18n } from './context/i18nContext'

// Route-level code splitting: each page becomes its own lazily-loaded chunk.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const ResearchPage = lazy(() =>
  import('./pages/ResearchPage').then((m) => ({ default: m.ResearchPage })),
)
const AcademyPage = lazy(() =>
  import('./pages/AcademyPage').then((m) => ({ default: m.AcademyPage })),
)
const AipPage = lazy(() => import('./pages/AipPage').then((m) => ({ default: m.AipPage })))
const JoinPage = lazy(() => import('./pages/JoinPage').then((m) => ({ default: m.JoinPage })))
const ChallengesPage = lazy(() =>
  import('./pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })),
)
const ChallengePage = lazy(() =>
  import('./pages/ChallengePage').then((m) => ({ default: m.ChallengePage })),
)
const TeamsPage = lazy(() => import('./pages/TeamsPage').then((m) => ({ default: m.TeamsPage })))
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
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
  const { t } = useI18n()
  return <div className="max-w-7xl mx-auto text-center py-20 text-gray-500">{t('common.loading')}</div>
}

export function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          {/* Public */}
          <Route path="/join" element={<JoinPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Everything else requires sign-in (guests → /join) */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/academy"
            element={
              <RequireAuth>
                <AcademyPage />
              </RequireAuth>
            }
          />
          <Route
            path="/aip"
            element={
              <RequireAuth>
                <AipPage />
              </RequireAuth>
            }
          />
          <Route
            path="/challenges"
            element={
              <RequireAuth>
                <ChallengesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/challenges/:id"
            element={
              <RequireAuth>
                <ChallengePage />
              </RequireAuth>
            }
          />
          <Route
            path="/teams"
            element={
              <RequireAuth>
                <TeamsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/research"
            element={
              <RequireAuth>
                <ResearchPage />
              </RequireAuth>
            }
          />
          <Route
            path="/network"
            element={
              <RequireAuth>
                <NetworkPage />
              </RequireAuth>
            }
          />
          <Route
            path="/resources"
            element={
              <RequireAuth>
                <ResourcesPage />
              </RequireAuth>
            }
          />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}
