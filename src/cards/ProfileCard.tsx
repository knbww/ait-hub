import { Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMyAip } from '../hooks/useMyAip'
import { aipRank } from '../lib/aip'

export function ProfileCard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { session, profile, role } = useAuth()
  const { data: aip = 0 } = useMyAip(profile?.id)

  if (!session) {
    return (
      <div className="relative">
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
          <h2 className="text-2xl font-light mb-4">{t('profile.cardTitle')}</h2>
          <p className="text-sm text-gray-600 mb-4">{t('profile.signInPrompt')}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 border border-gray-900 rounded-lg text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
          >
            {t('toolbar.login')}
          </button>
        </GlassCard>
      </div>
    )
  }

  const displayName = profile?.full_name ?? session.user.email ?? t('roles.member')
  const rank = aipRank(aip, role)
  const span = rank.ceil != null ? rank.ceil - rank.floor : 0
  const pctToNext = span > 0 ? Math.min(100, Math.round(((aip - rank.floor) / span) * 100)) : 100

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-light">{t('profile.cardTitle')}</h2>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div>
              <p className="font-normal">{displayName}</p>
              <p className="text-gray-600 font-light text-sm">{t(`roles.${role}`)}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            title={t('profile.settingsTitle')}
            className="hover:scale-125 hover:rotate-12 transition-all duration-300"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-white/20 border border-white/50">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-xs text-gray-600">{t('profile.balance')}</p>
              <p className="text-3xl font-light leading-none">{aip}</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#750014]/10 text-[#750014]">
              {t(`rank.${rank.current}`)}
            </span>
          </div>
          {rank.next && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: `${pctToNext}%` }} />
              </div>
              <p className="text-xs text-gray-500">
                {t('profile.toRank', { rank: t(`rank.${rank.next}`), n: rank.toNext ?? 0 })}
              </p>
            </>
          )}
          {profile?.id && (
            <button
              onClick={() => navigate(`/aip?member=${profile.id}`)}
              className="mt-2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t('profile.myJournal')}
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
