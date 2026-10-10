import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { GlassCard } from './GlassCard'
import { MfaPrompt } from './MfaPrompt'
import { errorKey } from '../lib/errors'
import { btnPrimary, btnSecondary } from '../lib/ui'

export function PageLoading() {
  const { t } = useI18n()
  return <div className="max-w-md mx-auto text-center py-20 text-gray-600">{t('common.loading')}</div>
}

function Blocked({ title, text }: { title: string; text: string }) {
  const { t } = useI18n()
  const { signOut } = useAuth()
  return (
    <div className="max-w-md mx-auto">
      <GlassCard className="text-center">
        <h1 className="text-2xl font-light mb-2">{title}</h1>
        <p className="text-sm text-gray-700 mb-5">{text}</p>
        <button onClick={() => void signOut()} className={btnSecondary}>
          {t('common.signOut')}
        </button>
      </GlassCard>
    </div>
  )
}

function LoadFailed({ error }: { error: unknown }) {
  const { t } = useI18n()
  const { refreshProfile } = useAuth()
  return (
    <div className="max-w-md mx-auto">
      <GlassCard className="text-center">
        <p className="text-sm text-gray-700 mb-4">{t(errorKey(error))}</p>
        <button onClick={() => void refreshProfile()} className={btnPrimary}>{t('common.retry')}</button>
      </GlassCard>
    </div>
  )
}

/** Signed-in, active members only; guests go to /join. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading, profileError, mfaPending } = useAuth()
  const { t } = useI18n()

  if (loading) return <PageLoading />
  if (!session) return <Navigate to="/join" replace />
  if (mfaPending) return <MfaPrompt />
  if (profileError) return <LoadFailed error={profileError} />
  if (!profile) return <Blocked title={t('auth.noProfile.title')} text={t('auth.noProfile.text')} />
  if (profile.status !== 'active') return <Blocked title={t('auth.inactive.title')} text={t('auth.inactive.text')} />
  return <>{children}</>
}

/** Track leads, director and curator. Server-side the same rule is enforced by RLS. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { isStaff } = useAuth()
  return (
    <RequireAuth>
      {isStaff ? children : <Navigate to="/" replace />}
    </RequireAuth>
  )
}
