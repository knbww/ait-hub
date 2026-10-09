import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, BrainCircuit, CalendarCheck, Code2, Rocket, Trophy } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { ErrorText } from '../components/DataState'
import { OauthNotice } from '../components/OauthNotice'
import { cardVariants, pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { supabase } from '../lib/supabase'
import { claimTrack } from '../lib/memberActions'
import { GRADES } from '../lib/club'
import { btnPrimary, btnSecondary, inputClass, labelClass } from '../lib/ui'
import logo from '../assets/aitlogo.png'

interface CodeCheck {
  code: string
  trackTitle: string | null
}

async function lookupCode(code: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('check_join_code', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  const row = (data as { track_title: string }[] | null)?.[0]
  return row?.track_title ?? null
}

/** Pick up a code from the QR link and say which track it belongs to. */
function useCodeFromUrl() {
  const [params] = useSearchParams()
  const urlCode = (params.get('code') ?? '').trim().toUpperCase()
  const [check, setCheck] = useState<CodeCheck | null>(null)

  useEffect(() => {
    if (!urlCode) return
    let active = true
    lookupCode(urlCode)
      .then((title) => active && setCheck({ code: urlCode, trackTitle: title }))
      .catch(() => active && setCheck({ code: urlCode, trackTitle: null }))
    return () => {
      active = false
    }
  }, [urlCode])

  return { urlCode, check: check?.code === urlCode ? check : null, setCheck }
}

function SignUpForm({ code, trackTitle, onReset }: { code: string; trackTitle: string; onReset: () => void }) {
  const { t } = useI18n()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [grade, setGrade] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [telegram, setTelegram] = useState('')
  const [photo, setPhoto] = useState<'yes' | 'no' | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('weak_password')
    if (!photo) return setError('photo_choice')
    setBusy(true)
    setError(null)
    const res = await signUp({
      email,
      password,
      fullName,
      grade: Number(grade),
      joinCode: code,
      telegram,
      photoConsent: photo === 'yes',
    })
    setBusy(false)
    if (res.error) return setError(res.error)
    if (res.needsConfirmation) return setNotice(t('join.form.confirmEmail'))
    navigate('/', { replace: true })
  }

  if (notice) return <p className="text-sm text-green-800 bg-green-600/10 rounded-xl p-4">{notice}</p>

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#750014]/10 px-4 py-3">
        <span className="text-sm">
          {t('join.form.track')} <strong className="font-medium">{trackTitle}</strong>
        </span>
        <button type="button" onClick={onReset} className="text-xs text-gray-600 underline">
          {t('join.form.otherCode')}
        </button>
      </div>
      <div>
        <label className={labelClass} htmlFor="j-name">{t('join.form.name')}</label>
        <input id="j-name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)}
          autoComplete="name" required maxLength={120} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="j-grade">{t('join.form.grade')}</label>
          <select id="j-grade" className={inputClass} value={grade} onChange={(e) => setGrade(e.target.value)} required>
            <option value="" disabled>{t('join.form.gradePick')}</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>{t('common.gradeN', { n: g })}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="j-tg">{t('join.form.telegram')}</label>
          <input id="j-tg" className={inputClass} value={telegram} onChange={(e) => setTelegram(e.target.value)}
            placeholder="@username" autoCapitalize="off" maxLength={64} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="j-email">{t('join.form.email')}</label>
        <input id="j-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" required />
      </div>
      <div>
        <label className={labelClass} htmlFor="j-pass">{t('join.form.password')}</label>
        <input id="j-pass" type="password" className={inputClass} value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-gray-500 mt-1">{t('join.form.passwordHint')}</p>
      </div>
      <fieldset>
        <legend className={labelClass}>{t('join.form.photo')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['yes', 'no'] as const).map((v) => (
            <label key={v}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer ${
                photo === v ? 'border-gray-900 bg-white/80' : 'border-white/70 bg-white/40'
              }`}>
              <input type="radio" name="photo" value={v} checked={photo === v} onChange={() => setPhoto(v)} />
              {t(`join.form.photo.${v}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {error === 'photo_choice' ? (
        <p className="text-sm text-red-700" role="alert">{t('join.form.photoRequired')}</p>
      ) : (
        <ErrorText error={error} />
      )}
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? t('common.wait') : t('join.form.submit')}
      </button>
    </form>
  )
}

function CodeEntry({ onFound }: { onFound: (check: CodeCheck) => void }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const title = await lookupCode(code)
      if (title) onFound({ code: code.trim().toUpperCase(), trackTitle: title })
      else setError('invalid_join_code')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <label className={labelClass} htmlFor="j-code">{t('join.code.label')}</label>
      <div className="flex gap-2">
        <input id="j-code" className={`${inputClass} uppercase tracking-widest`} value={code}
          onChange={(e) => setCode(e.target.value)} placeholder="ABCD2345" autoCapitalize="characters"
          autoComplete="off" required maxLength={12} />
        <button type="submit" disabled={busy || !code.trim()} className={btnPrimary}>
          <ArrowRight className="w-4 h-4" />
          <span className="sr-only">{t('join.code.next')}</span>
        </button>
      </div>
      <ErrorText error={error} />
      <p className="text-xs text-gray-600">{t('join.code.hint')}</p>
    </form>
  )
}

/** Already signed in: join a track with a code (accounts from before tracks), or go in. */
function SignedIn({ urlCode }: { urlCode: string }) {
  const { t } = useI18n()
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const canClaim = Boolean(urlCode && profile && !profile.track_id)

  const claim = async () => {
    setBusy(true)
    const res = await claimTrack(urlCode)
    setBusy(false)
    if (res.error) return setError(res.error)
    await refreshProfile()
    navigate('/', { replace: true })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">{canClaim ? t('join.signedIn.claim') : t('join.signedIn.text')}</p>
      <ErrorText error={error} />
      <div className="flex flex-wrap justify-center gap-2">
        {canClaim && (
          <button onClick={claim} disabled={busy} className={btnPrimary}>
            {t('join.signedIn.claimButton')}
          </button>
        )}
        <Link to="/" className={canClaim ? btnSecondary : btnPrimary}>
          {t('join.signedIn.open')}
        </Link>
      </div>
    </div>
  )
}

const TRACK_CARDS = [
  { id: 'ai', icon: BrainCircuit },
  { id: 'algo', icon: Code2 },
  { id: 'startup', icon: Rocket },
] as const

export function JoinPage() {
  const { t } = useI18n()
  const { session, loading } = useAuth()
  const { urlCode, check, setCheck } = useCodeFromUrl()
  const [manual, setManual] = useState<CodeCheck | null>(null)
  const active = manual ?? (check?.trackTitle ? check : null)

  let joinBlock
  if (loading) joinBlock = <p className="text-sm text-gray-600">{t('common.loading')}</p>
  else if (session) joinBlock = <SignedIn urlCode={urlCode} />
  else if (active?.trackTitle) {
    joinBlock = (
      <SignUpForm code={active.code} trackTitle={active.trackTitle}
        onReset={() => { setManual(null); setCheck(null) }} />
    )
  } else {
    joinBlock = (
      <>
        {check && !check.trackTitle && (
          <p className="text-sm text-red-700 mb-3" role="alert">{t('errors.invalid_join_code')}</p>
        )}
        <CodeEntry onFound={setManual} />
      </>
    )
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <motion.div variants={cardVariants}>
        <GlassCard className="text-center">
          <img src={logo} alt="" className="h-14 w-auto mx-auto mb-3" style={{ mixBlendMode: 'multiply' }} />
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">AIT Club</h1>
          <p className="text-[#750014] font-medium mb-2">{t('join.tagline')}</p>
          <p className="text-gray-700 max-w-xl mx-auto mb-5 text-sm sm:text-base">{t('join.intro')}</p>
          <div className="max-w-md mx-auto">
            <OauthNotice />
            {joinBlock}
          </div>
          {!session && (
            <p className="text-sm text-gray-600 mt-5">
              {t('join.haveAccount')}{' '}
              <Link to="/login" className="underline text-gray-900">{t('nav.signIn')}</Link>
            </p>
          )}
        </GlassCard>
      </motion.div>

      <motion.div variants={cardVariants}>
        <GlassCard>
          <h2 className="text-lg font-light mb-3">{t('join.tracks.title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TRACK_CARDS.map(({ id, icon: Icon }) => (
              <div key={id} className="p-4 rounded-2xl border border-white/60 bg-white/30">
                <Icon className="w-6 h-6 text-[#750014] mb-2" />
                <h3 className="font-normal mb-1">{t(`track.${id}`)}</h3>
                <p className="text-xs text-gray-700">{t(`join.tracks.${id}`)}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={cardVariants}>
        <GlassCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <CalendarCheck className="w-6 h-6 text-[#750014] shrink-0" />
              <div>
                <h3 className="font-normal mb-1">{t('join.year.title')}</h3>
                <p className="text-sm text-gray-700">{t('join.year.text')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Trophy className="w-6 h-6 text-[#750014] shrink-0" />
              <div>
                <h3 className="font-normal mb-1">{t('join.points.title')}</h3>
                <p className="text-sm text-gray-700">{t('join.points.text')}</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
