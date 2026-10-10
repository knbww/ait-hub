import { Link } from 'react-router-dom'
import { useI18n } from '../context/i18nContext'
import type { WeekProgress, WeekState } from '../lib/progress'

const STYLE: Record<WeekState, string> = {
  accepted: 'bg-green-600/80 text-white',
  submitted: 'bg-sky-500/70 text-white',
  needs_work: 'bg-amber-500/80 text-white',
  missed: 'bg-red-500/45 text-white',
  current: 'bg-white/80 ring-2 ring-[#750014] text-[#750014]',
  upcoming: 'bg-white/40 border border-white/70 text-gray-500',
  optional: 'bg-gray-400/30 text-gray-600',
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
          const cell = `aspect-square rounded-md text-[10px] sm:text-xs flex items-center justify-center ${STYLE[w.state]}`
          return (
            <li key={w.week.id}>
              {linkable ? (
                <Link to={`/program#week-${w.week.week_number}`} className={`${cell} hover:opacity-80`} title={title} aria-label={title}>
                  {w.week.week_number}
                </Link>
              ) : (
                <span className={cell} title={title}>{w.week.week_number}</span>
              )}
            </li>
          )
        })}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-600">
        {LEGEND.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${STYLE[s]}`} /> {t(`progress.state.${s}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
