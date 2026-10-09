import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useTrackRating } from '../hooks/useEvents'
import type { TrackId } from '../lib/db'

/** The member's track rating: their place and the top three. */
export function RatingCard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const track: TrackId = profile?.track_id ?? 'ai'
  const rating = useTrackRating(track)
  const rows = rating.data ?? []
  const myIndex = rows.findIndex((r) => r.profile_id === profile?.id)

  return (
    <CardShell icon={Trophy} title={t('card.rating', { track: t(`track.${track}.short`) })} to={`/rating?track=${track}`}
      linkLabel={t('card.all')}>
      <DataState isLoading={rating.isLoading} error={rating.error} onRetry={() => void rating.refetch()}
        empty={rows.length === 0} emptyText={t('rating.empty')}>
        {myIndex >= 0 && (
          <p className="text-sm mb-3">
            {t('rating.myPlace', { n: myIndex + 1, rating: rows[myIndex].rating })}
          </p>
        )}
        <ol className="space-y-1">
          {rows.slice(0, 3).map((r, i) => (
            <li key={r.profile_id}>
              <Link to={`/members/${r.profile_id}`} className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/40">
                <span className="w-5 text-sm text-gray-500">{i + 1}</span>
                <span className="flex-1 truncate text-sm">{r.full_name}</span>
                <span className="text-sm font-medium tabular-nums">{r.rating}</span>
              </Link>
            </li>
          ))}
        </ol>
      </DataState>
    </CardShell>
  )
}
