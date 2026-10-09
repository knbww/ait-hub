import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { errorKey } from '../lib/errors'

/** Why a GitHub sign-in bounced. The usual case: no club account with that email yet — the
 * sign-up trigger only creates accounts that come with a join code. */
export function OauthNotice() {
  const { t } = useI18n()
  const { oauthError, session } = useAuth()
  if (!oauthError || session) return null
  const key = /database error saving new user/i.test(oauthError) ? 'login.githubNoAccount' : errorKey(oauthError)
  return (
    <p className="text-sm text-red-700 bg-red-600/10 rounded-xl p-3 mb-4" role="alert">
      {t(key)}
    </p>
  )
}
