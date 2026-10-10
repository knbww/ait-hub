import { Link } from 'react-router-dom'
import { Newspaper, Pin } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { TrackBadge } from '../components/TrackBadge'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useNews } from '../hooks/useNews'
import { formatDate } from '../lib/club'

/** The latest club news: club-wide posts and the member's own track; staff see all. */
export function NewsCard() {
  const { t } = useI18n()
  const { profile, isStaff } = useAuth()
  const news = useNews()
  const track = profile?.track_id ?? null
  const items = (news.data ?? []).filter((n) => isStaff || !n.track_id || n.track_id === track).slice(0, 3)

  return (
    <CardShell icon={Newspaper} title={t('card.news')} to="/news" linkLabel={t('card.allNews')}>
      <DataState isLoading={news.isLoading} error={news.error} onRetry={() => void news.refetch()}
        empty={items.length === 0} emptyText={t('news.none')}>
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link to={`/news#news-${n.id}`}
                className="block p-3 rounded-2xl border border-white/50 bg-white/25 hover:bg-white/40 transition-colors">
                <span className="flex flex-wrap items-center gap-1.5 mb-1">
                  {n.pinned && <Pin className="w-3.5 h-3.5 text-[#750014]" aria-label={t('news.pinned')} />}
                  <span className="text-xs text-gray-600">{formatDate(n.published_at)}</span>
                  <TrackBadge track={n.track_id} />
                </span>
                <span className="block text-sm font-normal">{n.title}</span>
                <span className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </DataState>
    </CardShell>
  )
}
