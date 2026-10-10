import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Github } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { ErrorText } from '../components/DataState'
import { OauthNotice } from '../components/OauthNotice'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemo } from '../lib/demo'
import { Captcha } from '../components/Captcha'
import { captchaSiteKey } from '../lib/captcha'
import { btnPrimary, btnSecondary, inputClass, labelClass } from '../lib/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { session, signIn, signInWithGitHub } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)

  if (session) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (captchaSiteKey && !captcha) return setError('captcha_needed')
    setBusy(true)
    setError(null)
    const res = await signIn(email, password, captcha ?? undefined)
    setBusy(false)
    if (res.error) {
      setCaptchaReset((n) => n + 1)
      return setError(res.error)
    }
    navigate('/', { replace: true })
  }

  const github = async () => {
    setError(null)
    const res = await signInWithGitHub()
    if (res.error) setError(res.error)
  }

  const demoSignIn = async (demoEmail: string) => {
    setBusy(true)
    setError(null)
    const res = await signIn(demoEmail, DEMO_PASSWORD)
    setBusy(false)
    if (res.error) return setError(res.error)
    navigate('/', { replace: true })
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-md mx-auto">
      <GlassCard>
        <h1 className="text-2xl font-light mb-5 text-center">{t('login.title')}</h1>
        <OauthNotice />
        {isDemo && (
          <div className="mb-5 rounded-2xl border border-[#750014]/20 bg-[#750014]/5 p-3">
            <p className="text-sm font-medium mb-2">{t('demo.title')}</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} type="button" disabled={busy} onClick={() => demoSignIn(a.email)}
                  className={`${btnSecondary} !px-2 text-xs sm:text-sm`}>
                  {t(a.label)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">{t('demo.password', { password: DEMO_PASSWORD })}</p>
          </div>
        )}
        {!isSupabaseConfigured && (
          <p className="mb-4 text-sm text-amber-800 bg-amber-100/70 rounded-xl p-3">{t('login.notConfigured')}</p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="l-email">{t('join.form.email')}</label>
            <input id="l-email" type="email" className={inputClass} value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div>
            <label className={labelClass} htmlFor="l-pass">{t('join.form.password')}</label>
            <input id="l-pass" type="password" className={inputClass} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <Captcha onToken={setCaptcha} resetKey={captchaReset} />
          <ErrorText error={error} />
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? t('common.wait') : t('login.submit')}
          </button>
        </form>
        {!isDemo && (
          <>
            <div className="my-4 text-center text-xs text-gray-500">{t('login.or')}</div>
            <button onClick={github} className={`${btnSecondary} w-full`}>
              <Github className="w-4 h-4" /> {t('login.github')}
            </button>
            <p className="text-xs text-gray-600 text-center mt-2">{t('login.githubHint')}</p>
          </>
        )}
        <div className="mt-5 space-y-2 text-sm text-gray-700 text-center">
          <p>{t('login.forgot')}</p>
          <p>
            {t('login.noAccount')}{' '}
            <Link to="/join" className="underline text-gray-900">{t('nav.join')}</Link>
          </p>
        </div>
      </GlassCard>
    </motion.div>
  )
}
