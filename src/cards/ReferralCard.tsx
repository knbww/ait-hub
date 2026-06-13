import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Gift } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMyReferral } from '../hooks/useMyReferral'
import { referralUrl } from '../lib/referral'

// Keep the QR generator out of the main bundle.
const QRCodeSVG = lazy(() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })))

export function ReferralCard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { session, profile } = useAuth()
  const { data: ref } = useMyReferral(profile?.id)
  const [copied, setCopied] = useState(false)

  if (!session) {
    return (
      <div className="relative">
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-6 h-6" />
            <h2 className="text-2xl font-light">{t('referral.title')}</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">{t('referral.signInPrompt')}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 border border-gray-900 rounded-lg text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
          >
            {t('toolbar.login')}
          </button>
        </GlassCard>
      </div>
    )
  }

  const url = ref?.code ? referralUrl(ref.code) : ''

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-6 h-6" />
          <h2 className="text-2xl font-light">{t('referral.title')}</h2>
        </div>

        {url ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-2xl bg-white">
                <Suspense fallback={<div className="w-32 h-32" />}>
                  <QRCodeSVG value={url} size={128} />
                </Suspense>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                readOnly
                value={url}
                className="flex-1 px-3 py-2 rounded-lg border border-white/60 bg-white/40 text-xs outline-none truncate"
              />
              <button
                onClick={copy}
                className="px-3 py-2 rounded-lg border border-gray-900 hover:bg-gray-900 hover:text-white transition-all duration-300"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-4 text-sm text-gray-700 mb-2">
              <span>{t('referral.invited', { n: ref?.invitedCount ?? 0 })}</span>
              <span>{t('referral.reachedW3', { n: ref?.rewardedCount ?? 0 })}</span>
            </div>
            <p className="text-xs text-gray-500">{t('referral.hint')}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">{t('referral.loading')}</p>
        )}
      </GlassCard>
    </div>
  )
}
