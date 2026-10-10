import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen, CalendarDays, FolderKanban, House, Menu, Newspaper, Shield, Sparkles, Trophy, User, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { Modal } from './Modal'
import logo from '../assets/aitlogo.png'

interface NavItem {
  key: string
  path: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { key: 'nav.home', path: '/', icon: House },
  { key: 'nav.news', path: '/news', icon: Newspaper },
  { key: 'nav.program', path: '/program', icon: BookOpen },
  { key: 'nav.calendar', path: '/calendar', icon: CalendarDays },
  { key: 'nav.points', path: '/points', icon: Sparkles },
  { key: 'nav.rating', path: '/rating', icon: Trophy },
  { key: 'nav.teams', path: '/teams', icon: Users },
  { key: 'nav.projects', path: '/projects', icon: FolderKanban },
]

/** Phone tab bar: the four daily sections + "more" (news is also on the home screen). */
const TAB_PATHS = ['/', '/program', '/calendar', '/points']
const TABS = NAV.filter((item) => TAB_PATHS.includes(item.path))
const MORE = NAV.filter((item) => !TAB_PATHS.includes(item.path))

const isActive = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)

/** Top toolbar on desktop; on phones a slim top bar plus a bottom tab bar. */
export function Navbar() {
  const { pathname } = useLocation()
  const { session, isStaff } = useAuth()
  const { t } = useI18n()
  const [moreOpen, setMoreOpen] = useState(false)

  const toolbar = 'backdrop-blur-[40px] bg-white/50 border border-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.12)]'

  return (
    <>
      <header className="max-w-7xl mx-auto mb-5 sm:mb-8 sticky top-2 sm:top-4 z-50">
        <div className={`${toolbar} rounded-2xl px-3 sm:px-4 py-2 flex items-center gap-3`}>
          <Link to={session ? '/' : '/join'} className="shrink-0" aria-label="AIT Hub">
            <img src={logo} alt="AIT Hub" className="h-9 sm:h-10 w-auto" style={{ mixBlendMode: 'multiply' }} />
          </Link>

          {session ? (
            <>
              <nav className="hidden lg:flex items-center gap-1 flex-1" aria-label={t('nav.label')}>
                {NAV.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive: active }) =>
                      `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                        active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white/70'
                      }`
                    }
                  >
                    {t(item.key)}
                  </NavLink>
                ))}
              </nav>
              <div className="flex-1 lg:hidden" />
              <div className="flex items-center gap-1 shrink-0">
                {isStaff && (
                  <NavLink
                    to="/manage"
                    title={t('nav.manage')}
                    className={({ isActive: active }) =>
                      `flex items-center gap-2 p-2.5 lg:px-3 lg:py-1.5 rounded-lg text-sm transition-colors ${
                        active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white/70'
                      }`
                    }
                  >
                    <Shield className="w-5 h-5 lg:w-4 lg:h-4" />
                    <span className="hidden lg:inline">{t('nav.manage')}</span>
                  </NavLink>
                )}
                <NavLink
                  to="/profile"
                  title={t('nav.profile')}
                  aria-label={t('nav.profile')}
                  className={({ isActive: active }) =>
                    `p-2.5 rounded-lg transition-colors ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white/70'}`
                  }
                >
                  <User className="w-5 h-5" />
                </NavLink>
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              {pathname !== '/login' && (
                <Link to="/login" className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm">
                  {t('nav.signIn')}
                </Link>
              )}
              {pathname !== '/join' && (
                <Link to="/join" className="px-4 py-2 rounded-xl border border-gray-900 text-sm">
                  {t('nav.join')}
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {session && (
        <nav
          className={`lg:hidden fixed bottom-0 inset-x-0 z-50 ${toolbar} border-x-0 border-b-0 rounded-t-2xl px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]`}
          aria-label={t('nav.label')}
        >
          <div className="grid grid-cols-5">
            {TABS.map((item) => {
              const active = isActive(pathname, item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] ${
                    active ? 'text-[#750014] font-medium' : 'text-gray-600'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon className="w-6 h-6" />
                  {t(item.key)}
                </Link>
              )
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] ${
                MORE.some((i) => isActive(pathname, i.path)) ? 'text-[#750014] font-medium' : 'text-gray-600'
              }`}
            >
              <Menu className="w-6 h-6" />
              {t('nav.more')}
            </button>
          </div>
        </nav>
      )}

      {moreOpen && (
        <Modal title={t('nav.more')} onClose={() => setMoreOpen(false)}>
          <div className="grid gap-2">
            {[...MORE, ...(isStaff ? [{ key: 'nav.manage', path: '/manage', icon: Shield }] : []), { key: 'nav.profile', path: '/profile', icon: User }].map(
              (item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/70 ${
                    isActive(pathname, item.path) ? 'bg-gray-900 text-white' : 'bg-white/50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {t(item.key)}
                </Link>
              ),
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
