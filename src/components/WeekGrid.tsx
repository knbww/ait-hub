import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useI18n } from '../context/i18nContext'
import type { WeekProgress, WeekState } from '../lib/progress'

// Dark text on light fills (7:1 and more), and a mark besides the colour — colour alone isn't
// enough for colour-blind members.
const STYLE: Record<WeekState, string> = {
  accepted: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-700/25',
  submitted: 'bg-sky-100 text-sky-900 ring-1 ring-sky-700/25',
  needs_work: 'bg-amber-100 text-amber-900 ring-1 ring-amber-700/30',
  missed: 'bg-rose-100 text-rose-900 ring-1 ring-rose-700/25',
  current: 'bg-white ring-2 ring-[#750014] text-[#750014] font-semibold',
  upcoming: 'bg-white/60 ring-1 ring-gray-900/10 text-gray-600',
  optional: 'bg-gray-100 text-gray-600 ring-1 ring-gray-900/10',
}

const MARK: Partial<Record<WeekState, string>> = {
  accepted: '✓',
  submitted: '⏳',
  needs_work: '↺',
  missed: '!',
}

const LEGEND: WeekState[] = ['accepted', 'submitted', 'needs_work', 'missed', 'current', 'upcoming']

/** All 36 weeks at a glance; a square opens its week in the programme. */
export function WeekGrid({ weeks, linkable = true }: { weeks: WeekProgress[]; linkable?: boolean }) {
  const { t } = useI18n()
  return (
    <div>
      <ol className="grid grid-cols-9 sm:grid-cols-12 gap-1.5">
        {weeks.map((w) => {
          const title = `${t('week.number', { n: w.week.week_number })} · ${w.week.title} · ${t(`progress.state.${w.state}`)}`
          const cell = `relative aspect-square rounded-md text-[11px] sm:text-xs tabular-nums flex items-center justify-center ${STYLE[w.state]}`
          const mark = MARK[w.state]
          return (
            <motion.li key={w.week.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(w.week.week_number * 0.004, 0.15), duration: 0.18 }}>
              {linkable ? (
                <Link to={`/program#week-${w.week.week_number}`} className={`${cell} hover:brightness-95`} title={title} aria-label={title}>
                  {w.week.week_number}
                  {mark && <span className="absolute top-0.5 right-1 text-[8px] sm:text-[9px] leading-none" aria-hidden="true">{mark}</span>}
                </Link>
              ) : (
                <span className={cell} title={title}>
                  {w.week.week_number}
                  {mark && <span className="absolute top-0.5 right-1 text-[8px] sm:text-[9px] leading-none" aria-hidden="true">{mark}</span>}
                </span>
              )}
            </motion.li>
          )
        })}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-600">
        {LEGEND.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded-sm text-[9px] flex items-center justify-center ${STYLE[s]}`} aria-hidden="true">{MARK[s] ?? ''}</span>
            {t(`progress.state.${s}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
