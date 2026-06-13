import { useNavigate } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useHelpRequests } from '../hooks/useHelpRequests'
import { useI18n } from '../context/i18nContext'

/** Dashboard widget: open help-board requests. */
export function HelpBoardCard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { data: help = [] } = useHelpRequests()
  const openCount = help.filter((h) => h.status === 'open').length

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-6 h-6" />
          <h2 className="text-2xl font-light">{t('card.help')}</h2>
        </div>
        <p className="text-sm text-gray-700 mb-4">{t('help.openCount', { n: openCount })}</p>
        <button
          onClick={() => navigate('/teams')}
          className="w-full px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm"
        >
          {t('help.boardLink')}
        </button>
      </GlassCard>
    </div>
  )
}
