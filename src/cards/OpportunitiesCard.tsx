import { Link } from 'react-router-dom'
import { Award } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { DeadlineChip } from '../components/OpportunityBits'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMySaves, useOpportunities } from '../hooks/useOpportunities'
import { byUrgency, deadlineState, suits } from '../lib/opportunities'

/** The nearest application deadlines: what the member saved first, then what suits them. */
export function OpportunitiesCard() {
  const { t } = useI18n()
  const { profile, isStaff } = useAuth()
  const opportunities = useOpportunities()
  const saves = useMySaves(profile?.id)
  const open = (opportunities.data ?? [])
    .filter((o) => !o.hidden && deadlineState(o).kind === 'open')
    .filter((o) => isStaff || suits(o, profile))
    .sort((a, b) => Number(saves.data?.has(b.id) ?? false) - Number(saves.data?.has(a.id) ?? false) || byUrgency(a, b))
    .slice(0, 4)

  return (
    <CardShell icon={Award} title={t('card.opportunities')} to="/opportunities" linkLabel={t('card.allOpportunities')}>
      <DataState isLoading={opportunities.isLoading} error={opportunities.error} onRetry={() => void opportunities.refetch()}
        empty={open.length === 0} emptyText={t('opp.noneOpen')}>
        <ul className="space-y-2">
          {open.map((o) => (
            <li key={o.id}>
              <Link to={`/opportunities/${o.id}`}
                className="block p-3 rounded-2xl border border-white/50 bg-white/25 hover:bg-white/40 transition-colors">
                <span className="block text-sm font-normal leading-snug">{o.title}</span>
                <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <DeadlineChip o={o} />
                  {saves.data?.has(o.id) && <span className="text-xs text-[#750014]">{t('opp.saved')}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </DataState>
    </CardShell>
  )
}
