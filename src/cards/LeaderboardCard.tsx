import { Crown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { useAipLeaderboard } from '../hooks/useAipLeaderboard'
import { useI18n } from '../context/i18nContext'

export function LeaderboardCard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { data: leaderboardData = [] } = useAipLeaderboard('all')

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-light">{t('card.leaderboard')}</h2>
          <Crown className="w-6 h-6" />
        </div>

        <div className="space-y-4">
          {leaderboardData.slice(0, 8).map((user, index) => (
            <button
              key={user.profileId ?? index}
              onClick={() => navigate(user.profileId ? `/aip?member=${user.profileId}` : '/aip')}
              className="w-full flex items-center justify-between py-3 px-4 border-b border-gray-200/50 last:border-0 rounded-xl hover:bg-white/30 hover:shadow-[0_4px_16px_0_rgba(31,38,135,0.15)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 overflow-hidden flex items-center justify-center text-xl">
                  {user.avatar?.startsWith('http') ? (
                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.avatar
                  )}
                </div>
                <span className="font-normal">{user.name}</span>
              </div>
              <span className="font-medium text-lg">{user.aip}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/aip')}
          className="mt-4 w-full text-sm text-gray-600 hover:text-gray-900 transition-colors text-right"
        >
          {t('leaderboard.journalLink')}
        </button>
      </GlassCard>
    </div>
  )
}
