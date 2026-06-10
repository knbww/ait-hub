import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { ResearchPage } from './pages/ResearchPage'
import { NetworkPage } from './pages/NetworkPage'
import { ResourcesPage } from './pages/ResourcesPage'

export function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
      </Routes>
    </AnimatePresence>
  )
}
