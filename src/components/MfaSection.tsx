import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { ErrorText } from './DataState'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { confirmCode, disableTotp, startTotp, verifiedTotpId } from '../lib/mfa'
import type { TotpSetup } from '../lib/mfa'
import { btnPrimary, btnSecondary, btnDanger, inputClass, sectionTitle } from '../lib/ui'

/** Profile section for staff: turn the authenticator-app code on or off. */
export function MfaSection() {
  const { t } = useI18n()
  const { isOversight, refreshMfa } = useAuth()
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [setup, setSetup] = useState<TotpSetup | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let active = true
    void verifiedTotpId().then((id) => active && setFactorId(id))
    return () => {
      active = false
    }
  }, [])

  const begin = async () => {
    setBusy(true)
    setError(null)
    const res = await startTotp()
    setBusy(false)
    if (res.error || !res.data) return setError(res.error)
    setSetup(res.data)
  }

  const finish = async (e: FormEvent) => {
    e.preventDefault()
    if (!setup) return
    setBusy(true)
    setError(null)
    const res = await confirmCode(setup.factorId, code)
    if (res.error) {
      setBusy(false)
      setCode('')
      return setError(res.error)
    }
    await refreshMfa()
    setFactorId(setup.factorId)
    setSetup(null)
    setCode('')
    setBusy(false)
  }

  const turnOff = async () => {
    if (!factorId || !window.confirm(t('mfa.offConfirm'))) return
    setBusy(true)
    setError(null)
    const res = await disableTotp(factorId)
    if (res.error) {
      setBusy(false)
      return setError(res.error)
    }
    await refreshMfa()
    setFactorId(null)
    setBusy(false)
  }

  return (
    <GlassCard>
      <div id="mfa" className="scroll-mt-24" />
      <h2 className={`${sectionTitle} flex items-center gap-2`}><ShieldCheck className="w-5 h-5 text-[#750014]" /> {t('mfa.title')}</h2>
      {factorId === undefined ? null : factorId ? (
        <>
          <p className="text-sm text-gray-700 mt-1 mb-3">{t('mfa.on')}</p>
          <button onClick={turnOff} disabled={busy} className={btnDanger}>{t('mfa.turnOff')}</button>
        </>
      ) : setup ? (
        <form onSubmit={finish} className="mt-2 space-y-3">
          <p className="text-sm text-gray-700">{t('mfa.scan')}</p>
          <img src={setup.qrCode} alt={t('mfa.qrAlt')} className="w-44 h-44 rounded-xl bg-white p-2" />
          <p className="text-xs text-gray-600 break-all">{t('mfa.secret')} <code className="font-mono">{setup.secret}</code></p>
          <input className={`${inputClass} max-w-[12rem] text-center tracking-[0.3em]`} value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="000000" aria-label={t('mfa.code')} required />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className={btnPrimary}>{t('mfa.confirm')}</button>
            <button type="button" onClick={() => setSetup(null)} className={btnSecondary}>{t('common.cancel')}</button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm text-gray-700 mt-1 mb-3">{isOversight ? t('mfa.offOversight') : t('mfa.offStaff')}</p>
          <button onClick={begin} disabled={busy} className={btnPrimary}>{t('mfa.turnOn')}</button>
        </>
      )}
      <ErrorText error={error} />
    </GlassCard>
  )
}
