import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { Settings } from 'lucide-react'
import { AnimatedBackground } from './AnimatedBackground'
import { Navbar } from './Navbar'
import { AnimatedRoutes } from '../AnimatedRoutes'
import { useDevMode } from '../context/devModeContext'

export function Layout() {
  const { isDevMode } = useDevMode()

  return (
    <OverlayScrollbarsComponent
      defer
      options={{
        scrollbars: {
          theme: 'os-theme-ait',
          autoHide: 'move',
          autoHideDelay: 600,
          autoHideSuspend: false,
          clickScroll: true,
        },
      }}
      className="h-screen w-full"
    >
      <div
        className="relative w-full bg-gradient-to-br from-gray-100 via-[#750014]/5 p-8 font-light"
        style={{
          fontFamily:
            "'SF Pro Rounded', 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          // TODO(Phase 0 debt): replace this non-standard `zoom` hack with proper
          // responsive sizing. Kept for now so the app renders at the same scale.
          zoom: '80%',
        }}
      >
        <AnimatedBackground />

        <div className="relative z-10 p-8 min-h-screen">
          {isDevMode && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-6 py-2 rounded-full shadow-2xl animate-bounce flex items-center gap-2">
              <Settings className="w-4 h-4 animate-spin" />
              <span className="font-bold text-sm tracking-widest uppercase">
                Developer Mode: Edit Layout
              </span>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold tracking-wider">
              AIT<span className="font-light">HUB</span>
            </h1>
          </div>

          <Navbar />
          <AnimatedRoutes />
        </div>
      </div>
    </OverlayScrollbarsComponent>
  )
}
