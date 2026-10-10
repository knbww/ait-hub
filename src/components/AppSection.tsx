import { useEffect, useState } from 'react'
import { BellRing, Smartphone } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { ErrorText } from './DataState'
import { useI18n } from '../context/i18nContext'
import { isIos, isStandalone, promptInstall, useInstallAvailable } from '../lib/install'
import { currentSubscription, disablePush, enablePush, pushSupported } from '../lib/push'
import { btnPrimary, btnSecondary, sectionTitle } from '../lib/ui'

/** Profile: install the Hub as an app and turn notifications on for this device. */
export function AppSection() {
  const { t } = useI18n()
  const canInstall = useInstallAvailable()
  const standalone = isStandalone()
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const supported = pushSupported()
  const blocked = supported && Notification.permission === 'denied'

  useEffect(() => {
    let active = true
    void currentSubscription().then((s) => active && setSubscribed(Boolean(s)))
    return () => {
      active = false
    }
  }, [])

  const toggle = async () => {
    setBusy(true)
    setError(null)
    const res = subscribed ? await disablePush() : await enablePush()
    setBusy(false)
    if (res.error) return setError(res.error)
    setSubscribed(!subscribed)
  }

  return (
    <GlassCard>
      <h2 className={`${sectionTitle} flex items-center gap-2`}><Smartphone className="w-5 h-5 text-[#750014]" /> {t('app.title')}</h2>
      <div className="mt-2 space-y-3 text-sm text-gray-700">
        {standalone ? (
          <p>{t('app.installed')}</p>
        ) : canInstall ? (
          <div>
            <p className="mb-2">{t('app.installHint')}</p>
            <button onClick={() => void promptInstall()} className={btnSecondary}>{t('app.install')}</button>
          </div>
        ) : isIos() ? (
          <p>{t('app.iosHint')}</p>
        ) : (
          <p>{t('app.browserHint')}</p>
        )}

        <div className="pt-1">
          <p className="font-medium text-gray-900 flex items-center gap-2 mb-1"><BellRing className="w-4 h-4" /> {t('app.notifications')}</p>
          {!supported ? (
            <p>{isIos() && !standalone ? t('app.pushIosInstallFirst') : t('app.pushUnsupported')}</p>
          ) : blocked ? (
            <p>{t('app.pushBlocked')}</p>
          ) : (
            <>
              <p className="mb-2">{subscribed ? t('app.pushOn') : t('app.pushOff')}</p>
              {subscribed !== null && (
                <button onClick={toggle} disabled={busy} className={subscribed ? btnSecondary : btnPrimary}>
                  {subscribed ? t('app.pushDisable') : t('app.pushEnable')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <ErrorText error={error} />
    </GlassCard>
  )
}
