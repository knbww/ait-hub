import { Suspense, lazy, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Copy, Maximize2, RefreshCw } from 'lucide-react'
import { Modal } from './Modal'
import { ErrorText } from './DataState'
import { useI18n } from '../context/i18nContext'
import { rotateJoinCode } from '../lib/memberActions'
import type { JoinCodeRow } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, inputClass, labelClass } from '../lib/ui'
import { publicOrigin } from '../lib/origin'
import { formatDate } from '../lib/club'

// Keep the QR generator out of the main bundle.
const QRCodeSVG = lazy(() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })))

const joinLink = (code: string) => `${publicOrigin}/join?code=${code}`

const DAYS = [7, 14, 30]
const LIMITS = [0, 20, 40, 60]

/** A new code replaces the old one at once; it works for a chosen time and number of sign-ups. */
function NewCodeDialog({ code, onClose }: { code: JoinCodeRow; onClose: () => void }) {
  const { t } = useI18n()
  const [days, setDays] = useState(14)
  const [limit, setLimit] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await rotateJoinCode(code.track_id, days, limit || null)
    setBusy(false)
    if (res.error) return setError(res.error)
    onClose()
  }

  return (
    <Modal title={t('codes.newTitle', { track: t(`track.${code.track_id}`) })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="c-days">{t('codes.days')}</label>
            <select id="c-days" className={inputClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>{t('codes.daysN', { n: d })}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="c-limit">{t('codes.limit')}</label>
            <select id="c-limit" className={inputClass} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {LIMITS.map((n) => <option key={n} value={n}>{n ? t('codes.limitN', { n }) : t('codes.noLimit')}</option>)}
            </select>
          </div>
        </div>
        <p className="text-sm text-gray-700">{t('codes.newHint')}</p>
        <ErrorText error={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>{t('codes.create')}</button>
          <button type="button" onClick={onClose} className={btnSecondary}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}

/** «до 27 октября · вступили 3 из 40», or what's wrong with the code. */
function CodeTerms({ code }: { code: JoinCodeRow }) {
  const { t } = useI18n()
  // Checked when the list was loaded; a code that runs out meanwhile shows on the next load.
  const [loadedAt] = useState(() => Date.now())
  const expired = code.expires_at !== null && Date.parse(code.expires_at) <= loadedAt
  const usedUp = code.max_uses !== null && code.uses >= code.max_uses
  if (expired || usedUp) {
    return <p className="text-sm text-[#a3203a] mb-2">{t(expired ? 'codes.expired' : 'codes.usedUp')}</p>
  }
  const uses = code.max_uses ? t('codes.usesOf', { n: code.uses, max: code.max_uses }) : t('codes.uses', { n: code.uses })
  return (
    <p className="text-xs text-gray-600 mb-2">
      {code.expires_at ? `${t('codes.until', { date: formatDate(code.expires_at) })} · ` : ''}{uses}
    </p>
  )
}

/** A track's join code as a QR to show at the meeting: scan → sign-up form → profile. */
export function JoinCodePanel({ code, allowRotate = true }: { code: JoinCodeRow; allowRotate?: boolean }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [big, setBig] = useState(false)
  const [rotating, setRotating] = useState(false)
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

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <button onClick={() => setBig(true)} className="p-2 rounded-2xl bg-white shrink-0" aria-label={t('codes.showQr')}>
        <Suspense fallback={<div className="w-28 h-28" />}>
          <QRCodeSVG value={link} size={112} />
        </Suspense>
      </button>
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-xs text-gray-600">{t(`track.${code.track_id}`)}</p>
        <p className="text-2xl font-mono tracking-[0.2em] mb-1">{code.code}</p>
        <CodeTerms code={code} />
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <button onClick={copy} className={`${btnSmall} border border-gray-900/30 hover:bg-white/60`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {t('codes.copyLink')}
          </button>
          <button onClick={() => setBig(true)} className={`${btnSmall} border border-gray-900/30 hover:bg-white/60`}>
            <Maximize2 className="w-3.5 h-3.5" /> {t('codes.showQr')}
          </button>
          {allowRotate && (
            <button onClick={() => setRotating(true)} className={`${btnSmall} border border-gray-900/30 hover:bg-white/60`}>
              <RefreshCw className="w-3.5 h-3.5" /> {t('codes.rotate')}
            </button>
          )}
        </div>
      </div>
      {rotating && <NewCodeDialog code={code} onClose={() => setRotating(false)} />}

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
