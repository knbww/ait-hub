import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Camera, LayoutGrid, Sparkles } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useDevMode } from '../context/devModeContext'
import { useMyAip } from '../hooks/useMyAip'
import { useMyProfile } from '../hooks/useMyProfile'
import { ReferralCard } from '../cards/ReferralCard'
import { uploadAvatar, updateProfileInfo } from '../lib/profileActions'
import { generateProfileScore } from '../lib/profileScore'
import { aipRank } from '../lib/aip'
import type { Lang } from '../lib/messages'
import type { ProfileInfo } from '../lib/db-rows'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-700'
  if (score >= 40) return 'text-amber-700'
  return 'text-red-700'
}

/** Editable general-info form. Mounted with `key={profileId}` so `useState` hydrates from
 * `initial` once the profile loads — no setState-in-effect. */
function GeneralInfoForm({
  initial,
  userId,
  profileId,
}: {
  initial: ProfileInfo
  userId: string
  profileId: string
}) {
  const { t } = useI18n()
  const { refreshProfile } = useAuth()
  const [form, setForm] = useState<ProfileInfo>(initial)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const set =
    (k: keyof ProfileInfo) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    setMsg(null)
    const { error } = await updateProfileInfo(userId, profileId, form)
    await refreshProfile()
    setSaving(false)
    setMsg(error ?? t('settings.infoSaved'))
  }

  return (
    <div className="pt-1">
      <p className="text-sm font-medium mb-2">{t('settings.generalInfo')}</p>
      <div className="space-y-2">
        <input className={inputClass} placeholder={t('settings.name')} value={form.full_name} onChange={set('full_name')} />
        <textarea className={inputClass} rows={3} placeholder={t('settings.bio')} value={form.bio ?? ''} onChange={set('bio')} />
        <input className={inputClass} placeholder={t('settings.titleField')} value={form.title ?? ''} onChange={set('title')} />
        <input className={inputClass} placeholder={t('settings.github')} value={form.github_url ?? ''} onChange={set('github_url')} />
        <input className={inputClass} placeholder={t('settings.leetcode')} value={form.leetcode_url ?? ''} onChange={set('leetcode_url')} />
        <input className={inputClass} placeholder={t('settings.linkedin')} value={form.linkedin_url ?? ''} onChange={set('linkedin_url')} />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
        >
          {saving ? t('settings.uploading') : t('settings.saveInfo')}
        </button>
        {msg && <span className="text-xs text-green-700">{msg}</span>}
      </div>
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()
  const { isDevMode, setDevMode } = useDevMode()
  const { session, profile, role, signOut, refreshProfile } = useAuth()

  const { data: aip = 0 } = useMyAip(profile?.id)
  const { data: myProfile } = useMyProfile(profile?.id)
  const rank = aipRank(aip, role)

  const [tab, setTab] = useState<'profile' | 'appearance'>('profile')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [scoring, setScoring] = useState(false)
  const [scoreErr, setScoreErr] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    setUploading(true)
    await uploadAvatar(session.user.id, file)
    await refreshProfile()
    setUploading(false)
  }

  const runScore = async () => {
    if (!profile?.id) return
    setScoring(true)
    setScoreErr(false)
    const res = await generateProfileScore(profile.id)
    setScoring(false)
    if ('error' in res) setScoreErr(true)
  }

  const tabClass = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-sm transition-colors ${
      active ? 'bg-gray-900 text-white' : 'border border-white/60 bg-white/30 hover:bg-white/60'
    }`

  const aiScore = myProfile?.ai_profile_score ?? null

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-md mx-auto space-y-6"
    >
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-4">{t('settings.title')}</h2>
        <div className="flex gap-2 mb-6">
          <button className={tabClass(tab === 'profile')} onClick={() => setTab('profile')}>
            {t('settings.tabProfile')}
          </button>
          <button className={tabClass(tab === 'appearance')} onClick={() => setTab('appearance')}>
            {t('settings.tabAppearance')}
          </button>
        </div>

        {tab === 'profile' ? (
          <div className="space-y-5">
            {/* Identity */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 overflow-hidden shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div>
                <p className="text-lg font-normal leading-tight">{profile?.full_name ?? '—'}</p>
                <p className="text-xs text-gray-500">{t(`roles.${role}`)}</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="mt-1 px-3 py-1 rounded-lg border border-gray-900 text-xs inline-flex items-center gap-1.5 hover:bg-gray-900 hover:text-white transition-all duration-300 disabled:opacity-60"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {uploading ? t('settings.uploading') : t('settings.uploadAvatar')}
                </button>
              </div>
            </div>

            {/* Scores: AIP (reputation) + AI profile score */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/60 bg-white/30 px-4 py-3">
                <p className="text-xs text-gray-600">{t('profile.balance')}</p>
                <p className="text-3xl font-light leading-none">{aip}</p>
                <p className="text-xs text-[#750014] mt-1">{t(`rank.${rank.current}`)}</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/30 px-4 py-3">
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#750014]" /> {t('profile.aiScoreTitle')}
                </p>
                <p className={`text-3xl font-light leading-none ${aiScore != null ? scoreColor(aiScore) : 'text-gray-400'}`}>
                  {aiScore != null ? aiScore : '—'}
                </p>
                <button
                  onClick={runScore}
                  disabled={scoring}
                  className="text-xs text-[#750014] mt-1 hover:underline disabled:opacity-60"
                >
                  {scoring ? t('profile.generating') : aiScore != null ? t('profile.regenerate') : t('profile.generate')}
                </button>
              </div>
            </div>
            {myProfile?.ai_profile_summary && (
              <p className="text-xs text-gray-600 italic -mt-2">«{myProfile.ai_profile_summary}»</p>
            )}
            {aiScore == null && !scoring && (
              <p className="text-xs text-gray-500 -mt-2">{t('profile.aiScoreHint')}</p>
            )}
            {scoreErr && <p className="text-xs text-red-600 -mt-2">{t('profile.aiError')}</p>}

            {/* Editable general info (keyed child hydrates from the loaded profile) */}
            {session && profile && myProfile ? (
              <GeneralInfoForm
                key={myProfile.id}
                userId={session.user.id}
                profileId={profile.id}
                initial={{
                  full_name: myProfile.full_name ?? '',
                  bio: myProfile.bio,
                  title: myProfile.title,
                  university: myProfile.university,
                  grad_year: myProfile.grad_year,
                  github_url: myProfile.github_url,
                  leetcode_url: myProfile.leetcode_url,
                  linkedin_url: myProfile.linkedin_url,
                }}
              />
            ) : (
              <p className="text-xs text-gray-500">{t('common.loading')}</p>
            )}

            <dl className="space-y-2 text-sm border-t border-white/40 pt-4">
              <div className="flex justify-between">
                <dt className="text-gray-600">{t('settings.email')}</dt>
                <dd className="font-normal">{session?.user.email ?? '—'}</dd>
              </div>
            </dl>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 border border-gray-900 rounded-lg text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
            >
              {t('settings.signOut')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">{t('settings.language')}</p>
              <div className="flex gap-2">
                {(['ru', 'en'] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={tabClass(lang === l)}>
                    {l === 'ru' ? 'Русский' : 'English'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">{t('settings.layoutSection')}</p>
              <p className="text-xs text-gray-500 mb-3">{t('settings.layoutHint')}</p>
              <button
                onClick={() => setDevMode(!isDevMode)}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm inline-flex items-center gap-2 hover:scale-[1.02] transition-all duration-300"
              >
                <LayoutGrid className="w-4 h-4" />
                {isDevMode ? t('settings.exitLayout') : t('settings.enterLayout')}
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {tab === 'profile' && <ReferralCard />}
    </motion.div>
  )
}
