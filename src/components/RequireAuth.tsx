import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'

/** Gates a route behind a signed-in session; sends guests to the /join landing. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const { t } = useI18n()

  if (loading) {
    return <div className="max-w-md mx-auto text-center py-20 text-gray-500">{t('common.loading')}</div>
  }
  if (!session) {
    return <Navigate to="/join" replace />
  }
  return <>{children}</>
}
