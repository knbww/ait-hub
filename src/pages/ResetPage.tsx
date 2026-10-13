import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { ErrorText } from '../components/DataState'
import { pageVariants } from '../lib/animations'
import { useI18n } from '../context/i18nContext'
import { resetPasswordWithCode } from '../lib/memberActions'
import { btnPrimary, inputClass, labelClass } from '../lib/ui'

/** A forgotten password, without email: a one-time code from the track lead (15 minutes), and the
 * member sets the new password themselves. */
export function ResetPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('weak_password')
    if (password !== repeat) return setError('mismatch')
    setBusy(true)
    setError(null)
    const res = await resetPasswordWithCode(email, code, password)
    setBusy(false)
    if (res.error) return setError(res.error)
    setDone(true)
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-md mx-auto">
      <GlassCard>
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-2xl bg-[#750014]/10 text-[#750014] flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </span>
          <h1 className="text-2xl font-light">{t('reset.title')}</h1>
        </div>
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-800">{t('reset.done')}</p>
            <Link to="/login" className={`${btnPrimary} w-full`}>{t('nav.signIn')}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-gray-700">{t('reset.intro')}</p>
            <div>
              <label className={labelClass} htmlFor="r-email">{t('join.form.email')}</label>
              <input id="r-email" className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" required />
            </div>
            <div>
              <label className={labelClass} htmlFor="r-code">{t('reset.code')}</label>
              <input id="r-code" className={`${inputClass} uppercase tracking-[0.2em] font-mono`} value={code}
                onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" autoCapitalize="characters"
                maxLength={12} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="r-password">{t('profile.newPassword')}</label>
              <input id="r-password" className={inputClass} type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="r-repeat">{t('profile.repeatPassword')}</label>
              <input id="r-repeat" className={inputClass} type="password" value={repeat}
                onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
            </div>
            {error === 'mismatch' ? <p className="text-sm text-red-700">{t('profile.mismatch')}</p> : <ErrorText error={error} />}
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? t('common.wait') : t('reset.submit')}</button>
            <p className="text-sm text-center text-gray-700"><Link to="/login" className="underline">{t('reset.back')}</Link></p>
          </form>
        )}
      </GlassCard>
    </motion.div>
  )
}
