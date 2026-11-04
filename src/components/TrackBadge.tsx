import { useI18n } from '../context/i18nContext'
import type { TrackId } from '../lib/db'
import { chip } from '../lib/ui'

// One accent for the club: the three directions share MIT Red and are told apart by their name.
const COLORS: Record<TrackId, string> = {
  ai: 'bg-[#750014]/10 text-[#750014]',
  algo: 'bg-[#750014]/10 text-[#750014]',
  startup: 'bg-[#750014]/10 text-[#750014]',
}

export function TrackBadge({ track, short = true }: { track: TrackId | null | undefined; short?: boolean }) {
  const { t } = useI18n()
  if (!track) return <span className={`${chip} bg-gray-900/5 text-gray-600`}>{t('track.all')}</span>
  return <span className={`${chip} ${COLORS[track]}`}>{t(short ? `track.${track}.short` : `track.${track}`)}</span>
}
