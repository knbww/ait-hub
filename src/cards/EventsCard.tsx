import { CalendarDays } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { EventLine } from '../components/EventLine'
import { useI18n } from '../context/i18nContext'
import { useEvents } from '../hooks/useEvents'
import { notOver } from '../lib/club'

/** The next confirmed club events. */
export function EventsCard() {
  const { t } = useI18n()
  const events = useEvents()
  const upcoming = (events.data ?? [])
    .filter((e) => e.status === 'confirmed' && notOver(e.starts_at, e.ends_at))
    .slice(0, 3)

  return (
    <CardShell icon={CalendarDays} title={t('card.events')} to="/calendar" linkLabel={t('card.calendar')}>
      <DataState isLoading={events.isLoading} error={events.error} onRetry={() => void events.refetch()}
        empty={upcoming.length === 0} emptyText={t('events.none')}>
        <ul className="space-y-2">
          {upcoming.map((e) => (
            <li key={e.id}>
              <EventLine event={e} compact />
            </li>
          ))}
        </ul>
      </DataState>
    </CardShell>
  )
}
