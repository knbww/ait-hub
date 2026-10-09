import { Suspense, lazy } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PageLoading, RequireAuth, RequireStaff } from './components/RequireAuth'

// Route-level code splitting: each page becomes its own lazily-loaded chunk.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const JoinPage = page(() => import('./pages/JoinPage'), 'JoinPage')
const LoginPage = page(() => import('./pages/LoginPage'), 'LoginPage')
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const ProgramPage = page(() => import('./pages/ProgramPage'), 'ProgramPage')
const CalendarPage = page(() => import('./pages/CalendarPage'), 'CalendarPage')
const PointsPage = page(() => import('./pages/PointsPage'), 'PointsPage')
const RatingPage = page(() => import('./pages/RatingPage'), 'RatingPage')
const TeamsPage = page(() => import('./pages/TeamsPage'), 'TeamsPage')
const ProjectsPage = page(() => import('./pages/ProjectsPage'), 'ProjectsPage')
const ProjectPage = page(() => import('./pages/ProjectPage'), 'ProjectPage')
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage')
const MemberPage = page(() => import('./pages/MemberPage'), 'MemberPage')
const ManagePage = page(() => import('./pages/ManagePage'), 'ManagePage')
const NotFoundPage = page(() => import('./pages/NotFoundPage'), 'NotFoundPage')

const auth = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>

export function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoading />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/join" element={<JoinPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={auth(<DashboardPage />)} />
          <Route path="/program" element={auth(<ProgramPage />)} />
          <Route path="/calendar" element={auth(<CalendarPage />)} />
          <Route path="/points" element={auth(<PointsPage />)} />
          <Route path="/rating" element={auth(<RatingPage />)} />
          <Route path="/teams" element={auth(<TeamsPage />)} />
          <Route path="/projects" element={auth(<ProjectsPage />)} />
          <Route path="/projects/:id" element={auth(<ProjectPage />)} />
          <Route path="/profile" element={auth(<ProfilePage />)} />
          <Route path="/members/:id" element={auth(<MemberPage />)} />
          <Route path="/manage" element={<RequireStaff><ManagePage /></RequireStaff>} />

          {/* Old addresses from the June version */}
          <Route path="/academy" element={<Navigate to="/program" replace />} />
          <Route path="/aip" element={<Navigate to="/points" replace />} />
          <Route path="/challenges/*" element={<Navigate to="/rating" replace />} />
          <Route path="/admin" element={<Navigate to="/manage" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}
