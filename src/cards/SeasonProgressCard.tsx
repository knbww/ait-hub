import { useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useActiveSeason } from '../hooks/useActiveSeason'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { seasonProgress, weekStatus } from '../lib/academy'
import type { Submission } from '../types'

/** Dashboard widget: the member's progress through the active season + the
 * current week's status, with a jump to the full Academy page. */
export function SeasonProgressCard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { profile } = useAuth()
  const { data: season } = useActiveSeason()
  const { data: submissions } = useMySubmissions(profile?.id)
  const subs = submissions ?? new Map<string, Submission>()

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-6 h-6" />
          <h2 className="text-2xl font-light">{t('season.title')}</h2>
        </div>

        {!season ? (
          <p className="text-sm text-gray-600">{t('season.notOpen')}</p>
        ) : (
          (() => {
            const progress = seasonProgress(
              season.weeks.map((w) => w.id),
              subs,
            )
            const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
            const current =
              season.weeks.find((w) => {
                const s = subs.get(w.id)
                return !(s?.status === 'reviewed' && s.passed)
              }) ?? season.weeks[season.weeks.length - 1]
            const currentStatus = current ? weekStatus(subs.get(current.id)) : 'not_started'

            return (
              <>
                <h3 className="text-base font-normal mb-3">{season.title}</h3>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">{t('season.progress')}</span>
                    <span>{t('season.weeksOf', { done: progress.done, total: progress.total })}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#750014] h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {current && (
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-gray-700">
                      {t('season.weekTopic', { n: current.weekNumber, topic: current.topic })}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-900/10 text-gray-600">
                      {t(`weekStatus.${currentStatus}`)}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => navigate('/academy')}
                  className="w-full px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm"
                >
                  {t('season.openAcademy')}
                </button>
              </>
            )
          })()
        )}
      </GlassCard>
    </div>
  )
}
