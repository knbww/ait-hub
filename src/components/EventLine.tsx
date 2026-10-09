import { MapPin, Trophy, User } from 'lucide-react'
import { TrackBadge } from './TrackBadge'
import { useI18n } from '../context/i18nContext'
import type { EventRow } from '../lib/db'
import { formatDateTime } from '../lib/club'
import { chip } from '../lib/ui'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-900/10 text-gray-700',
  cancelled: 'bg-red-600/10 text-red-700',
  completed: 'bg-green-600/15 text-green-800',
}

/** One event: when, what, which track, who is responsible. */
export function EventLine({ event, compact = false }: { event: EventRow; compact?: boolean }) {
  const { t } = useI18n()
  const cancelled = event.status === 'cancelled'
  return (
    <div className={`p-3 rounded-2xl border border-white/50 bg-white/25 ${cancelled ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <span className="text-xs text-gray-600">{formatDateTime(event.starts_at)}</span>
        <TrackBadge track={event.track_id} />
        {event.is_rated && (
          <span className={`${chip} bg-[#750014]/10 text-[#750014]`}>
            <Trophy className="w-3 h-3" /> {t('event.rated')}
          </span>
        )}
        {event.status !== 'confirmed' && (
          <span className={`${chip} ${STATUS_STYLE[event.status]}`}>{t(`event.status.${event.status}`)}</span>
        )}
      </div>
      <p className={`text-sm font-normal ${cancelled ? 'line-through' : ''}`}>
        <span className="text-gray-500">{t(`event.type.${event.type}`)}:</span> {event.title}
      </p>
      {!compact && (event.location || event.responsible) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
          {event.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
          )}
          {event.responsible && (
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" /> {t('event.responsible', { name: event.responsible.full_name })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
