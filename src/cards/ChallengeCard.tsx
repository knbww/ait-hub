import { useNavigate } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useChallenges } from '../hooks/useChallenges'
import { useI18n } from '../context/i18nContext'

/** Dashboard widget surfacing the current open challenge. */
export function ChallengeCard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { data: challenges = [] } = useChallenges()
  const open = challenges.find((c) => c.status === 'open')

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-6 h-6" />
          <h2 className="text-2xl font-light">{t('card.challenge')}</h2>
        </div>

        {!open ? (
          <p className="text-sm text-gray-600">{t('challengeCard.none')}</p>
        ) : (
          <>
            <h3 className="text-base font-normal mb-1">{open.title}</h3>
            {open.deadline && (
              <p className="text-xs text-gray-500 mb-4">
                {t('challenges.until', { date: new Date(open.deadline).toLocaleDateString() })}
              </p>
            )}
            <button
              onClick={() => navigate(`/challenges/${open.id}`)}
              className="w-full px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm"
            >
              {t('challengeCard.participate')}
            </button>
          </>
        )}
      </GlassCard>
    </div>
  )
}
