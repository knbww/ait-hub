import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Award, BookOpen, FileCheck, MessageCircle, Sparkles, Users } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { ErrorText } from '../components/DataState'
import { OauthNotice } from '../components/OauthNotice'
import { Captcha } from '../components/Captcha'
import { captchaSiteKey } from '../lib/captcha'
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
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('weak_password')
    if (!photo) return setError('photo_choice')
    if (captchaSiteKey && !captcha) return setError('captcha_needed')
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
      captchaToken: captcha ?? undefined,
    })
    setBusy(false)
    if (res.error) {
      setCaptchaReset((n) => n + 1)
      return setError(res.error)
    }
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
      <Captcha onToken={setCaptcha} resetKey={captchaReset} />
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
  const { profile, refreshProfile, isStaff } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  // Staff without a track (director, curator) don't join one by scanning a code.
  const canClaim = Boolean(urlCode && profile && !profile.track_id && !isStaff)

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

const FEATURES = [
  { id: 'program', icon: BookOpen },
  { id: 'works', icon: FileCheck },
  { id: 'points', icon: Sparkles },
  { id: 'teams', icon: Users },
  { id: 'opportunities', icon: Award },
  { id: 'chats', icon: MessageCircle },
] as const

const CLUB_SITE = 'https://aitclub.org'

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
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-6xl mx-auto space-y-10 sm:space-y-16 pt-2 sm:pt-6">
      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-12 items-center">
        <motion.div variants={cardVariants} className="px-1">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#750014]">{t('join.hub.kicker')}</p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.08] mt-3">
            {t('join.hub.title')} <span className="text-[#750014]">{t('join.hub.titleAccent')}</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-700 mt-5 max-w-xl">{t('join.hub.lead')}</p>
          <div className="flex flex-wrap gap-2 mt-6 text-sm">
            {(['grades', 'tracks', 'free', 'app'] as const).map((k) => (
              <span key={k} className="px-3 py-1.5 rounded-full bg-white/55 border border-white/90 text-gray-700">{t(`join.hub.fact.${k}`)}</span>
            ))}
          </div>
          <a href={CLUB_SITE} className="inline-flex items-center gap-1.5 mt-6 text-sm text-gray-800 underline underline-offset-4 hover:text-[#750014]">
            {t('join.hub.aboutClub')} <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        <motion.div variants={cardVariants}>
          <GlassCard className="!p-5 sm:!p-7">
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="" className="h-10 w-auto" style={{ mixBlendMode: 'multiply' }} />
              <h2 className="text-xl font-light">{session ? t('join.hub.cardSignedIn') : t('join.hub.cardTitle')}</h2>
            </div>
            <OauthNotice />
            {joinBlock}
            {!session && (
              <p className="text-sm text-gray-600 mt-5 pt-4 border-t border-white/60">
                {t('join.haveAccount')}{' '}
                <Link to="/login" className="underline text-gray-900">{t('nav.signIn')}</Link>
              </p>
            )}
          </GlassCard>
        </motion.div>
      </section>

      <section>
        <motion.h2 variants={cardVariants} className="text-2xl sm:text-3xl font-light px-1 mb-5">{t('join.hub.featuresTitle')}</motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {FEATURES.map(({ id, icon: Icon }, i) => (
            <motion.div key={id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }} transition={{ delay: (i % 3) * 0.08, type: 'spring', stiffness: 260, damping: 26 }}>
              <GlassCard className="h-full hover:-translate-y-0.5 transition-transform">
                <span className="inline-flex w-11 h-11 rounded-2xl bg-[#750014]/10 text-[#750014] items-center justify-center mb-3">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-normal">{t(`join.hub.feature.${id}.title`)}</h3>
                <p className="text-sm text-gray-700 mt-1">{t(`join.hub.feature.${id}.text`)}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}>
        <GlassCard className="!p-6 sm:!p-10">
          <h2 className="text-2xl sm:text-3xl font-light">{t('join.hub.stepsTitle')}</h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mt-6">
            {[1, 2, 3].map((n) => (
              <li key={n} className="rounded-2xl bg-white/50 border border-white/80 p-4">
                <span className="w-8 h-8 rounded-full bg-[#750014] text-white text-sm font-semibold flex items-center justify-center mb-3">{n}</span>
                <p className="font-normal">{t(`join.hub.step${n}.title`)}</p>
                <p className="text-sm text-gray-700 mt-1">{t(`join.hub.step${n}.text`)}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-gray-700 mt-6">
            {t('join.hub.tracksNote')}{' '}
            <a href={`${CLUB_SITE}/#tracks`} className="underline underline-offset-4 hover:text-[#750014]">{t('join.hub.tracksLink')}</a>
          </p>
        </GlassCard>
      </motion.section>
    </motion.div>
  )
}
