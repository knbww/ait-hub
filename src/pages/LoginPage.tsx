import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Github } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { isSupabaseConfigured } from '../lib/supabase'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

export function LoginPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { signInWithPassword, signUpWithPassword, signInWithGitHub } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    const result =
      mode === 'signin'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password, fullName)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (mode === 'signup') {
      setNotice(t('login.accountCreated'))
      setMode('signin')
      return
    }
    navigate('/')
  }

  const github = async () => {
    setError(null)
    const { error: oauthError } = await signInWithGitHub()
    if (oauthError) setError(oauthError)
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-md mx-auto"
    >
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-6 text-center">
          {mode === 'signin' ? t('login.signin') : t('login.signup')}
        </h2>

        {!isSupabaseConfigured && (
          <p className="mb-4 text-sm text-amber-700 bg-amber-100/60 rounded-lg p-3">
            {t('login.supabaseWarn')}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <input
              className={inputClass}
              type="text"
              placeholder={t('login.fullName')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <input
            className={inputClass}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={inputClass}
            type="password"
            placeholder={t('login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-green-700">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-normal hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
          >
            {busy ? t('login.pleaseWait') : mode === 'signin' ? t('login.signinBtn') : t('login.signupBtn')}
          </button>
        </form>

        <div className="my-4 text-center text-xs text-gray-500">{t('login.or')}</div>

        <button
          onClick={github}
          className="w-full px-4 py-2 rounded-lg border border-gray-900 text-sm font-normal flex items-center justify-center gap-2 hover:bg-gray-900 hover:text-white transition-all duration-300"
        >
          <Github className="w-4 h-4" />
          {t('login.github')}
        </button>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
          className="mt-4 w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {mode === 'signin' ? t('login.toSignup') : t('login.toSignin')}
        </button>
      </GlassCard>
    </motion.div>
  )
}
