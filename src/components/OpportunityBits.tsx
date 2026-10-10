import { motion } from 'framer-motion'
import { Bookmark, Clock, EyeOff } from 'lucide-react'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMySaves } from '../hooks/useOpportunities'
import { setSaved } from '../lib/opportunityActions'
import { deadlineState } from '../lib/opportunities'
import { formatDay } from '../lib/club'
import type { OpportunityKind, OpportunityRow } from '../lib/db'
import { btnSmall, chip } from '../lib/ui'

const KIND_COLORS: Record<OpportunityKind, string> = {
  olympiad: 'bg-sky-600/10 text-sky-800',
  competition: 'bg-indigo-600/10 text-indigo-800',
  hackathon: 'bg-violet-600/10 text-violet-800',
  startup: 'bg-amber-600/15 text-amber-800',
  program: 'bg-emerald-600/10 text-emerald-800',
  camp: 'bg-teal-600/10 text-teal-800',
  internship: 'bg-lime-600/15 text-lime-800',
  grant: 'bg-rose-600/10 text-rose-800',
  course: 'bg-cyan-600/10 text-cyan-800',
  event: 'bg-gray-900/5 text-gray-700',
}

export function KindBadge({ kind }: { kind: OpportunityKind }) {
  const { t } = useI18n()
  return <span className={`${chip} ${KIND_COLORS[kind]}`}>{t(`opp.kind.${kind}`)}</span>
}

export function OpportunityBadges({ o }: { o: OpportunityRow }) {
  const { t } = useI18n()
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <KindBadge kind={o.kind} />
      <span className={`${chip} bg-gray-900/5 text-gray-700`}>{t(`opp.region.${o.region}`)}</span>
      {o.hidden && (
        <span className={`${chip} bg-gray-900 text-white`}><EyeOff className="w-3 h-3" /> {t('opp.hidden')}</span>
      )}
    </span>
  )
}

/** «до 13 октября · 3 дня», «старт 14 ноября», «приём закрыт» or «сроки — в описании». */
export function DeadlineChip({ o, large = false }: { o: OpportunityRow; large?: boolean }) {
  const { t, tp } = useI18n()
  const s = deadlineState(o)
  const size = large ? 'text-sm px-3 py-1' : ''
  if (s.kind === 'open') {
    const tone = s.days <= 7 ? 'bg-[#a3203a]/10 text-[#a3203a]' : s.days <= 30 ? 'bg-amber-500/15 text-amber-900' : 'bg-gray-900/5 text-gray-700'
    return (
      <span className={`${chip} ${tone} ${size}`}>
        <Clock className="w-3 h-3" />
        {t('opp.until', { date: formatDay(o.deadline!) })} · {s.days === 0 ? t('opp.today') : tp('opp.daysLeft', s.days)}
      </span>
    )
  }
  if (s.kind === 'upcoming') {
    return <span className={`${chip} bg-emerald-600/10 text-emerald-800 ${size}`}>{t('opp.starts', { date: formatDay(o.starts_on!) })}</span>
  }
  if (s.kind === 'closed') return <span className={`${chip} bg-gray-900/5 text-gray-500 ${size}`}>{t('opp.closed')}</span>
  return <span className={`${chip} bg-gray-900/5 text-gray-600 ${size}`}>{t('opp.ongoing')}</span>
}

/** «Хочу участвовать» — the member's own mark; reminders come before a saved deadline. */
export function SaveButton({ o, withLabel = false }: { o: OpportunityRow; withLabel?: boolean }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const saves = useMySaves(profile?.id)
  const saved = saves.data?.has(o.id) ?? false
  if (!profile) return null

  const toggle = () => void setSaved(o.id, profile.id, !saved)
  const label = saved ? t('opp.saved') : t('opp.save')
  return (
    <motion.button type="button" onClick={toggle} whileTap={{ scale: 0.9 }} aria-pressed={saved}
      aria-label={label} title={withLabel ? undefined : label}
      className={`${btnSmall} shrink-0 ${withLabel ? 'border px-3' : ''} ${saved
        ? 'text-[#750014] border-[#750014]/30 bg-[#750014]/5'
        : 'text-gray-700 border-gray-900/20 hover:bg-white/60'}`}>
      <motion.span key={saved ? 'on' : 'off'} initial={{ scale: saved ? 0.5 : 1 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 14 }} className="inline-flex">
        <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
      </motion.span>
      {withLabel && <span>{label}</span>}
    </motion.button>
  )
}
