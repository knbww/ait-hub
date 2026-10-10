import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Camera, Download, LayoutGrid, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { ErrorText } from '../components/DataState'
import { Avatar } from '../components/Avatar'
import { TrackBadge } from '../components/TrackBadge'
import { MfaSection } from '../components/MfaSection'
import { AppSection } from '../components/AppSection'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useDevMode } from '../context/devModeContext'
import { useMemberPrivate } from '../hooks/useManage'
import {
  changePassword, claimTrack, exportMemberData, removeAvatar, setPhotoConsent, updateMyProfile, updateMyTelegram, uploadAvatar,
} from '../lib/memberActions'
import { downloadJson, stampedName } from '../lib/download'
import { GRADES } from '../lib/club'
import type { ProfileRow } from '../lib/db'
import { btnPrimary, btnSecondary, inputClass, labelClass, pageTitle, sectionTitle } from '../lib/ui'

function Saved({ show }: { show: boolean }) {
  const { t } = useI18n()
  return show ? <span className="text-sm text-green-800">{t('common.saved')}</span> : null
}

function TrackSection({ profile }: { profile: ProfileRow }) {
  const { t } = useI18n()
  const { refreshProfile, isStaff } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const res = await claimTrack(code)
    if (res.error) return setError(res.error)
    await refreshProfile()
  }

  return (
    <GlassCard>
      <div id="track" className="scroll-mt-24" />
      <h2 className={sectionTitle}>{t('profile.track')}</h2>
      {profile.track_id ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TrackBadge track={profile.track_id} short={false} />
          <span className="text-xs text-gray-600">{t('profile.trackHint')}</span>
        </div>
      ) : isStaff ? (
        <p className="text-sm text-gray-700 mt-2">{t('profile.staffNoTrack')}</p>
      ) : (
        <form onSubmit={submit} className="mt-2 space-y-2">
          <p className="text-sm text-gray-700">{t('prompt.track')}</p>
          <div className="flex gap-2">
            <input className={`${inputClass} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD2345" maxLength={12} required />
            <button type="submit" className={btnPrimary}>{t('profile.join')}</button>
          </div>
          <ErrorText error={error} />
        </form>
      )}
    </GlassCard>
  )
}

function DetailsSection({ profile }: { profile: ProfileRow }) {
  const { t } = useI18n()
  const { refreshProfile } = useAuth()
  const [name, setName] = useState(profile.full_name)
  const [grade, setGrade] = useState(profile.grade ? String(profile.grade) : '')
  const [github, setGithub] = useState(profile.github_username ?? '')
  const [codeforces, setCodeforces] = useState(profile.codeforces_handle ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile.user_id) return
    setBusy(true)
    setError(null)
    setSaved(false)
    const res = await updateMyProfile(profile.user_id, {
      full_name: name,
      grade: Number(grade),
      github_username: github,
      codeforces_handle: codeforces,
    })
    setBusy(false)
    if (res.error) return setError(res.error)
    await refreshProfile()
    setSaved(true)
  }

  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('profile.details')}</h2>
      <form onSubmit={submit} className="space-y-3 mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
          <div>
            <label className={labelClass}>{t('join.form.name')}</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </div>
          <div>
            <label className={labelClass}>{t('join.form.grade')}</label>
            <select className={inputClass} value={grade} onChange={(e) => setGrade(e.target.value)} required>
              <option value="" disabled>{t('join.form.gradePick')}</option>
              {GRADES.map((g) => <option key={g} value={g}>{t('common.gradeN', { n: g })}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs font-medium text-gray-600 pt-1">{t('profile.connected')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>GitHub</label>
            <input className={inputClass} value={github} onChange={(e) => setGithub(e.target.value)} placeholder="username"
              autoCapitalize="off" maxLength={39} />
          </div>
          <div>
            <label className={labelClass}>Codeforces</label>
            <input className={inputClass} value={codeforces} onChange={(e) => setCodeforces(e.target.value)} placeholder="handle"
              autoCapitalize="off" maxLength={24} />
          </div>
        </div>
        <ErrorText error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>{t('common.save')}</button>
          <Saved show={saved} />
        </div>
      </form>
    </GlassCard>
  )
}

function ContactsSection({ profile, email }: { profile: ProfileRow; email: string | null | undefined }) {
  const { t } = useI18n()
  const priv = useMemberPrivate(profile.id)
  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('profile.contacts')}</h2>
      <p className="text-xs text-gray-600 mt-1">{t('profile.contactsHint')}</p>
      <dl className="mt-3 text-sm">
        <dt className="text-xs text-gray-600">{t('join.form.email')}</dt>
        <dd className="mb-3 break-all">{email ?? '—'}</dd>
      </dl>
      {priv.data !== undefined && (
        <TelegramForm key={priv.data?.telegram ?? ''} profileId={profile.id} initial={priv.data?.telegram ?? ''} />
      )}
    </GlassCard>
  )
}

function TelegramForm({ profileId, initial }: { profileId: string; initial: string }) {
  const { t } = useI18n()
  const [value, setValue] = useState(initial ? `@${initial}` : '')
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    const res = await updateMyTelegram(profileId, value)
    if (res.error) return setError(res.error)
    setError(null)
    setSaved(true)
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className={labelClass}>{t('join.form.telegram')}</label>
      <div className="flex gap-2">
        <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} placeholder="@username" maxLength={64} autoCapitalize="off" />
        <button type="submit" className={btnSecondary}>{t('common.save')}</button>
      </div>
      <ErrorText error={error} />
      <Saved show={saved} />
    </form>
  )
}

function PhotoSection({ profile }: { profile: ProfileRow }) {
  const { t } = useI18n()
  const { refreshProfile } = useAuth()
  const priv = useMemberPrivate(profile.id)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const run = async (fn: () => Promise<{ error: unknown }>) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) return setError(res.error)
    await refreshProfile()
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !profile.user_id) return
    if (file.size > 2 * 1024 * 1024) return setError('file_too_big')
    await run(() => uploadAvatar(profile.user_id!, file, profile.avatar_path))
  }

  const consent = priv.data?.photo_consent ?? null
  return (
    <GlassCard>
      <div id="photo" className="scroll-mt-24" />
      <h2 className={sectionTitle}>{t('profile.photo')}</h2>
      <p className="text-sm text-gray-700 mt-1 mb-3">{t('join.form.photo')}</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[true, false].map((v) => (
          <button key={String(v)} disabled={busy || !profile.user_id}
            onClick={() => run(() => setPhotoConsent(profile.id, profile.user_id!, v))}
            className={`rounded-xl border px-3 py-2.5 text-sm ${consent === v ? 'border-gray-900 bg-white/80' : 'border-white/70 bg-white/40'}`}
            aria-pressed={consent === v}>
            {t(`join.form.photo.${v ? 'yes' : 'no'}`)}
          </button>
        ))}
      </div>
      {consent === false && <p className="text-xs text-gray-600">{t('profile.photoOff')}</p>}
      {consent && (
        <div className="flex items-center gap-4">
          <Avatar path={profile.avatar_path} name={profile.full_name} size="lg" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className={btnSecondary}>
              <Camera className="w-4 h-4" /> {profile.avatar_path ? t('profile.photoChange') : t('profile.photoUpload')}
            </button>
            {profile.avatar_path && (
              <button onClick={() => run(() => removeAvatar(profile.user_id!))} disabled={busy} className={btnSecondary}>
                {t('profile.photoRemove')}
              </button>
            )}
          </div>
        </div>
      )}
      {error === 'file_too_big' ? <p className="text-sm text-red-700 mt-2">{t('profile.photoTooBig')}</p> : <ErrorText error={error} />}
    </GlassCard>
  )
}

function PasswordSection() {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    if (password.length < 8) return setError('weak_password')
    if (password !== repeat) return setError('mismatch')
    const res = await changePassword(password)
    if (res.error) return setError(res.error)
    setError(null)
    setPassword('')
    setRepeat('')
    setSaved(true)
  }

  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('profile.password')}</h2>
      <form onSubmit={submit} className="space-y-2 mt-3">
        <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t('profile.newPassword')} autoComplete="new-password" minLength={8} required />
        <input className={inputClass} type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)}
          placeholder={t('profile.repeatPassword')} autoComplete="new-password" required />
        {error === 'mismatch' ? <p className="text-sm text-red-700">{t('profile.mismatch')}</p> : <ErrorText error={error} />}
        <div className="flex items-center gap-3">
          <button type="submit" className={btnSecondary}>{t('profile.changePassword')}</button>
          <Saved show={saved} />
        </div>
      </form>
    </GlassCard>
  )
}

export function ProfilePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { session, profile, signOut, isStaff } = useAuth()
  const { isDevMode, setDevMode } = useDevMode()
  const [exportError, setExportError] = useState<unknown>(null)

  if (!profile) return null

  const download = async () => {
    const res = await exportMemberData(profile.id)
    if (res.error) return setExportError(res.error)
    downloadJson(stampedName('ait-hub-my-data', 'json'), res.data)
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-2xl mx-auto space-y-4">
      <GlassCard>
        <div className="flex items-center gap-4">
          <Avatar path={profile.avatar_path} name={profile.full_name} size="lg" />
          <div className="min-w-0">
            <h1 className={pageTitle}>{profile.full_name}</h1>
            <p className="text-sm text-gray-700">
              {t(`role.${profile.role}`)}
              {profile.grade ? ` · ${t('common.gradeN', { n: profile.grade })}` : ''}
            </p>
          </div>
        </div>
      </GlassCard>

      <TrackSection profile={profile} />
      <DetailsSection key={profile.id} profile={profile} />
      <ContactsSection profile={profile} email={session?.user.email} />
      <PhotoSection profile={profile} />
      <PasswordSection />
      {isStaff && <MfaSection />}
      <AppSection />

      <GlassCard>
        <h2 className={sectionTitle}>{t('profile.data')}</h2>
        <p className="text-sm text-gray-700 mt-1 mb-3">{t('profile.dataHint')}</p>
        <button onClick={download} className={btnSecondary}><Download className="w-4 h-4" /> {t('profile.download')}</button>
        <ErrorText error={exportError} />
      </GlassCard>

      <GlassCard>
        <h2 className={sectionTitle}>{t('profile.layout')}</h2>
        <p className="text-sm text-gray-700 mt-1 mb-3">{t('profile.layoutHint')}</p>
        <button onClick={() => { setDevMode(!isDevMode); if (!isDevMode) navigate('/') }} className={btnSecondary}>
          <LayoutGrid className="w-4 h-4" /> {isDevMode ? t('profile.layoutOff') : t('profile.layoutOn')}
        </button>
      </GlassCard>

      <button onClick={async () => { await signOut(); navigate('/join', { replace: true }) }} className={`${btnSecondary} w-full`}>
        <LogOut className="w-4 h-4" /> {t('common.signOut')}
      </button>
    </motion.div>
  )
}
