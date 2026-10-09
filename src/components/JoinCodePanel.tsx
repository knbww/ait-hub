import { Suspense, lazy, useState } from 'react'
import { Check, Copy, Maximize2, RefreshCw } from 'lucide-react'
import { Modal } from './Modal'
import { ErrorText } from './DataState'
import { useI18n } from '../context/i18nContext'
import { rotateJoinCode } from '../lib/memberActions'
import type { JoinCodeRow } from '../lib/db'
import { btnSmall } from '../lib/ui'
import { publicOrigin } from '../lib/origin'

// Keep the QR generator out of the main bundle.
const QRCodeSVG = lazy(() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })))

const joinLink = (code: string) => `${publicOrigin}/join?code=${code}`

/** A track's join code as a QR to show at the meeting: scan → sign-up form → profile. */
export function JoinCodePanel({ code, allowRotate = true }: { code: JoinCodeRow; allowRotate?: boolean }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [big, setBig] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const link = joinLink(code.code)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const rotate = async () => {
    if (!window.confirm(t('codes.rotateConfirm'))) return
    setBusy(true)
    const res = await rotateJoinCode(code.track_id)
    setBusy(false)
    setError(res.error)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <button onClick={() => setBig(true)} className="p-2 rounded-2xl bg-white shrink-0" aria-label={t('codes.showQr')}>
        <Suspense fallback={<div className="w-28 h-28" />}>
          <QRCodeSVG value={link} size={112} />
        </Suspense>
      </button>
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-xs text-gray-600">{t(`track.${code.track_id}`)}</p>
        <p className="text-2xl font-mono tracking-[0.2em] mb-2">{code.code}</p>
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <button onClick={copy} className={`${btnSmall} border border-gray-900/30 hover:bg-white/60`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {t('codes.copyLink')}
          </button>
          <button onClick={() => setBig(true)} className={`${btnSmall} border border-gray-900/30 hover:bg-white/60`}>
            <Maximize2 className="w-3.5 h-3.5" /> {t('codes.showQr')}
          </button>
          {allowRotate && (
            <button onClick={rotate} disabled={busy} className={`${btnSmall} border border-gray-900/30 hover:bg-white/60`}>
              <RefreshCw className="w-3.5 h-3.5" /> {t('codes.rotate')}
            </button>
          )}
        </div>
        <ErrorText error={error} />
      </div>

      {big && (
        <Modal title={t(`track.${code.track_id}`)} onClose={() => setBig(false)}>
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-white rounded-3xl">
              <Suspense fallback={<div className="w-72 h-72" />}>
                <QRCodeSVG value={link} size={288} />
              </Suspense>
            </div>
            <p className="text-3xl font-mono tracking-[0.25em]">{code.code}</p>
            <p className="text-sm text-gray-700 text-center">{t('codes.scanHint')}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
