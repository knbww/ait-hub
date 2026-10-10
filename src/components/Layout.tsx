import { LayoutGrid } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AnimatedBackground } from './AnimatedBackground'
import { Navbar } from './Navbar'
import { AnimatedRoutes } from '../AnimatedRoutes'
import { useAuth } from '../context/authContext'
import { useDevMode } from '../context/devModeContext'
import { useI18n } from '../context/i18nContext'
import { isDemo } from '../lib/demo'

/** Only in the demo copy: says the data is invented and lets you sign in as another role. */
function DemoBanner() {
  const { t } = useI18n()
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="max-w-7xl mx-auto mb-2 sm:mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-[#750014] text-white text-xs sm:text-sm px-3 py-1.5">
      <span>{t('demo.banner')}</span>
      {session && (
        <button onClick={() => void signOut().then(() => navigate('/login'))} className="underline underline-offset-2">
          {t('demo.switch')}
        </button>
      )}
    </div>
  )
}

export function Layout() {
  const { isDevMode, setDevMode } = useDevMode()
  const { t } = useI18n()

  return (
    <div className="relative min-h-dvh text-gray-900">
      <AnimatedBackground />
      <div className="relative z-10 px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-28 lg:pb-12">
        {isDevMode && (
          <button
            onClick={() => setDevMode(false)}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-sm"
          >
            <LayoutGrid className="w-4 h-4" />
            {t('layout.banner')}
          </button>
        )}
        {isDemo && <DemoBanner />}
        <Navbar />
        <main>
          <AnimatedRoutes />
        </main>
      </div>
    </div>
  )
}
