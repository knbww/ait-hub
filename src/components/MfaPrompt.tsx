import { useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { ErrorText } from './DataState'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { confirmCode, verifiedTotpId } from '../lib/mfa'
import { isOwnDevice, setOwnDevice } from '../lib/trustedDevice'
import { btnPrimary, btnSecondary, inputClass } from '../lib/ui'

/** After the password (or GitHub): the code from the authenticator app. */
export function MfaPrompt() {
  const { t } = useI18n()
  const { refreshMfa, signOut, isOversight } = useAuth()
  const [code, setCode] = useState('')
  const [own, setOwn] = useState(isOwnDevice)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const factorId = await verifiedTotpId()
    const res = factorId ? await confirmCode(factorId, code) : { error: new Error('mfa_no_factor') }
    if (res.error) {
      setBusy(false)
      setCode('')
      return setError(res.error)
    }
    // Only director and curator are signed out after an idle hour: for them it matters.
    if (isOversight) setOwnDevice(own)
    await refreshMfa()
    setBusy(false)
  }

  return (
    <div className="max-w-sm mx-auto">
      <GlassCard className="text-center">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[#750014]" />
        <h1 className="text-2xl font-light mb-2">{t('mfa.prompt.title')}</h1>
        <p className="text-sm text-gray-700 mb-4">{t('mfa.prompt.text')}</p>
        <form onSubmit={submit} className="space-y-3">
          <input className={`${inputClass} text-center tracking-[0.4em] text-lg`} value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" aria-label={t('mfa.code')}
            required minLength={6} maxLength={6} />
          {isOversight && (
            <label className="flex items-start gap-2 text-left text-sm">
              <input type="checkbox" className="mt-1" checked={own} onChange={(e) => setOwn(e.target.checked)} />
              <span>
                {t('mfa.prompt.own')}
                <span className="block text-xs text-gray-600">{t('mfa.prompt.ownHint')}</span>
              </span>
            </label>
          )}
          <ErrorText error={error} />
          <button type="submit" disabled={busy || code.length !== 6} className={`${btnPrimary} w-full`}>
            {busy ? t('common.wait') : t('mfa.prompt.submit')}
          </button>
        </form>
        <button onClick={() => void signOut()} className={`${btnSecondary} w-full mt-2`}>{t('common.signOut')}</button>
        <p className="text-xs text-gray-600 mt-4">{t('mfa.prompt.lost')}</p>
      </GlassCard>
    </div>
  )
}
