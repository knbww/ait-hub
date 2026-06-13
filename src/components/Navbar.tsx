import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Shield, User } from 'lucide-react'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { ApplyModal } from './ApplyModal'
import logo from '../assets/aitlogo.png'

const NAV = [
  { key: 'nav.home', path: '/' },
  { key: 'nav.academy', path: '/academy' },
  { key: 'nav.challenge', path: '/challenges' },
  { key: 'nav.teams', path: '/teams' },
  { key: 'nav.aip', path: '/aip' },
  { key: 'nav.research', path: '/research' },
  { key: 'nav.network', path: '/network' },
  { key: 'nav.resources', path: '/resources' },
]

function isActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

/** macOS-Finder-style top toolbar: wordmark on the left, route nav in the
 * middle, account actions on the right. */
export function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { session, role } = useAuth()
  const { t } = useI18n()
  const [applyOpen, setApplyOpen] = useState(false)

  return (
    <>
      <div className="max-w-7xl mx-auto mb-8 sticky top-4 z-50">
        <div className="backdrop-blur-[40px] bg-white/40 border border-white/70 rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] flex items-center gap-4">
          <button onClick={() => navigate('/')} className="shrink-0" title="AIT Hub">
            <img
              src={logo}
              alt="AIT Hub"
              className="h-10 w-auto"
              style={{ mixBlendMode: 'multiply' }}
            />
          </button>

          {session ? (
            <>
              <nav className="flex items-center gap-1 overflow-x-auto flex-1">
                {NAV.map((item) => {
                  const active = isActive(pathname, item.path)
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                        active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white/60'
                      }`}
                    >
                      {t(item.key)}
                    </button>
                  )
                })}
              </nav>

              <div className="flex items-center gap-2 shrink-0">
                {role === 'admin' && (
                  <button
                    onClick={() => navigate('/admin')}
                    title={t('toolbar.council')}
                    className="p-2 rounded-lg hover:bg-white/60 transition-colors"
                  >
                    <Shield className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => navigate('/profile')}
                  title={t('toolbar.profile')}
                  className="p-2 rounded-lg hover:bg-white/60 transition-colors"
                >
                  <User className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                onClick={() => setApplyOpen(true)}
                className="px-4 py-1.5 rounded-lg border border-gray-900 text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
              >
                {t('toolbar.apply')}
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:scale-105 transition-all duration-300"
              >
                {t('toolbar.login')}
              </button>
            </div>
          )}
        </div>
      </div>
      {applyOpen && <ApplyModal onClose={() => setApplyOpen(false)} />}
    </>
  )
}
