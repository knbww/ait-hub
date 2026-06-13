import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Camera, LayoutGrid } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useDevMode } from '../context/devModeContext'
import { ReferralCard } from '../cards/ReferralCard'
import { uploadAvatar, updateProfileName } from '../lib/profileActions'
import type { Lang } from '../lib/messages'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

export function ProfilePage() {
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()
  const { isDevMode, setDevMode } = useDevMode()
  const { session, profile, role, signOut, refreshProfile } = useAuth()

  const [tab, setTab] = useState<'profile' | 'appearance'>('profile')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

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

  const saveName = async () => {
    const value = nameRef.current?.value.trim()
    if (!session || !value) return
    setSavingName(true)
    setNameMsg(null)
    await updateProfileName(session.user.id, value)
    await refreshProfile()
    setSavingName(false)
    setNameMsg(t('settings.nameSaved'))
  }

  const tabClass = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-sm transition-colors ${
      active ? 'bg-gray-900 text-white' : 'border border-white/60 bg-white/30 hover:bg-white/60'
    }`

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
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 overflow-hidden shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFile}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded-lg border border-gray-900 text-sm inline-flex items-center gap-2 hover:bg-gray-900 hover:text-white transition-all duration-300 disabled:opacity-60"
                >
                  <Camera className="w-4 h-4" />
                  {uploading ? t('settings.uploading') : t('settings.uploadAvatar')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">{t('settings.name')}</label>
              <div className="flex gap-2">
                <input
                  ref={nameRef}
                  key={profile?.id ?? 'anon'}
                  defaultValue={profile?.full_name ?? ''}
                  className={inputClass}
                />
                <button
                  onClick={saveName}
                  disabled={savingName}
                  className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60 whitespace-nowrap"
                >
                  {t('settings.saveName')}
                </button>
              </div>
              {nameMsg && <p className="text-xs text-green-700 mt-1">{nameMsg}</p>}
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">{t('settings.email')}</dt>
                <dd className="font-normal">{session?.user.email ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">{t('settings.role')}</dt>
                <dd className="font-normal">{t(`roles.${role}`)}</dd>
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
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={tabClass(lang === l)}
                  >
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
