import { useI18n } from '../context/i18nContext'
import type { TrackId } from '../lib/db'
import { chip } from '../lib/ui'

const COLORS: Record<TrackId, string> = {
  ai: 'bg-violet-600/10 text-violet-800',
  algo: 'bg-sky-600/10 text-sky-800',
  startup: 'bg-amber-600/15 text-amber-800',
}

export function TrackBadge({ track, short = true }: { track: TrackId | null | undefined; short?: boolean }) {
  const { t } = useI18n()
  if (!track) return <span className={`${chip} bg-gray-900/5 text-gray-600`}>{t('track.all')}</span>
  return <span className={`${chip} ${COLORS[track]}`}>{t(short ? `track.${track}.short` : `track.${track}`)}</span>
}
