import { Suspense, lazy, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PageLoading, RequireAuth, RequireStaff } from './components/RequireAuth'
import { reloadForNewVersion } from './lib/staleVersion'
import { useI18n } from './context/i18nContext'

// Route-level code splitting: each page becomes its own lazily-loaded chunk. A chunk that is
// gone because a newer version was published meanwhile reloads the page once.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })).catch((error: unknown) => {
    if (reloadForNewVersion()) return new Promise<never>(() => {})
    throw error
  }))

const JoinPage = page(() => import('./pages/JoinPage'), 'JoinPage')
const LoginPage = page(() => import('./pages/LoginPage'), 'LoginPage')
const ResetPage = page(() => import('./pages/ResetPage'), 'ResetPage')
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const ProgramPage = page(() => import('./pages/ProgramPage'), 'ProgramPage')
const CalendarPage = page(() => import('./pages/CalendarPage'), 'CalendarPage')
const NewsPage = page(() => import('./pages/NewsPage'), 'NewsPage')
const OpportunitiesPage = page(() => import('./pages/OpportunitiesPage'), 'OpportunitiesPage')
const ChatsPage = page(() => import('./pages/ChatsPage'), 'ChatsPage')
const OpportunityPage = page(() => import('./pages/OpportunityPage'), 'OpportunityPage')
const ProgressPage = page(() => import('./pages/ProgressPage'), 'ProgressPage')
const PointsPage = page(() => import('./pages/PointsPage'), 'PointsPage')
const RatingPage = page(() => import('./pages/RatingPage'), 'RatingPage')
const TeamsPage = page(() => import('./pages/TeamsPage'), 'TeamsPage')
const TeamPage = page(() => import('./pages/TeamPage'), 'TeamPage')
const ProjectsPage = page(() => import('./pages/ProjectsPage'), 'ProjectsPage')
const ProjectPage = page(() => import('./pages/ProjectPage'), 'ProjectPage')
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage')
const MemberPage = page(() => import('./pages/MemberPage'), 'MemberPage')
const ManagePage = page(() => import('./pages/ManagePage'), 'ManagePage')
const NotFoundPage = page(() => import('./pages/NotFoundPage'), 'NotFoundPage')

const auth = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>

/** The browser tab says which page is open (and screen readers announce it). */
const TITLES: [RegExp, string][] = [
  [/^\/$/, 'nav.home'],
  [/^\/news/, 'nav.news'],
  [/^\/opportunities/, 'nav.opportunities'],
  [/^\/program/, 'nav.program'],
  [/^\/calendar/, 'nav.calendar'],
  [/^\/points/, 'nav.points'],
  [/^\/rating/, 'nav.rating'],
  [/^\/teams/, 'nav.teams'],
  [/^\/projects/, 'nav.projects'],
  [/^\/chats/, 'nav.chats'],
  [/^\/progress/, 'card.progress'],
  [/^\/profile/, 'nav.profile'],
  [/^\/members/, 'title.member'],
  [/^\/manage/, 'nav.manage'],
  [/^\/join/, 'nav.join'],
  [/^\/login/, 'nav.signIn'],
  [/^\/reset/, 'reset.title'],
]

export function AnimatedRoutes() {
  const location = useLocation()
  const { t } = useI18n()

  useEffect(() => {
    const key = TITLES.find(([pattern]) => pattern.test(location.pathname))?.[1]
    document.title = key ? `${t(key)} · AIT Hub` : 'AIT Hub'
  }, [location.pathname, t])

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoading />}>
        <Routes location={location} key={location.pathname.startsWith('/chats') ? '/chats' : location.pathname}>
          <Route path="/join" element={<JoinPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset" element={<ResetPage />} />

          <Route path="/" element={auth(<DashboardPage />)} />
          <Route path="/program" element={auth(<ProgramPage />)} />
          <Route path="/calendar" element={auth(<CalendarPage />)} />
          <Route path="/news" element={auth(<NewsPage />)} />
          <Route path="/opportunities" element={auth(<OpportunitiesPage />)} />
          <Route path="/opportunities/:id" element={auth(<OpportunityPage />)} />
          <Route path="/chats" element={auth(<ChatsPage />)} />
          <Route path="/chats/:id" element={auth(<ChatsPage />)} />
          <Route path="/progress" element={auth(<ProgressPage />)} />
          <Route path="/points" element={auth(<PointsPage />)} />
          <Route path="/rating" element={auth(<RatingPage />)} />
          <Route path="/teams" element={auth(<TeamsPage />)} />
          <Route path="/teams/:id" element={auth(<TeamPage />)} />
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
