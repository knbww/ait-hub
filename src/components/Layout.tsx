import { LayoutGrid } from 'lucide-react'
import { AnimatedBackground } from './AnimatedBackground'
import { Navbar } from './Navbar'
import { AnimatedRoutes } from '../AnimatedRoutes'
import { useDevMode } from '../context/devModeContext'
import { useI18n } from '../context/i18nContext'

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
        <Navbar />
        <main>
          <AnimatedRoutes />
        </main>
      </div>
    </div>
  )
}
