import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Newspaper, Pin } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { TrackBadge } from '../components/TrackBadge'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useNews, useNewsPhotoUrls } from '../hooks/useNews'
import { formatDate } from '../lib/club'

/** The latest club news: club-wide posts and the member's own track; staff see all. */
export function NewsCard() {
  const { t } = useI18n()
  const { profile, isStaff } = useAuth()
  const news = useNews()
  const track = profile?.track_id ?? null
  const items = (news.data ?? []).filter((n) => isStaff || !n.track_id || n.track_id === track).slice(0, 3)
  const covers = items.map((n) => n.photos[0]).filter((p): p is string => Boolean(p))
  const { data: urls } = useNewsPhotoUrls(covers)

  return (
    <CardShell icon={Newspaper} title={t('card.news')} to="/news" linkLabel={t('card.allNews')}>
      <DataState isLoading={news.isLoading} error={news.error} onRetry={() => void news.refetch()}
        empty={items.length === 0} emptyText={t('news.none')}>
        <ul className="space-y-2">
          {items.map((n) => {
            const cover = n.photos[0] ? urls?.[n.photos[0]] : undefined
            const likes = n.likes?.length ?? 0
            const comments = n.comments?.length ?? 0
            return (
              <li key={n.id}>
                <Link to={`/news#news-${n.id}`}
                  className="flex gap-3 p-3 rounded-2xl border border-white/50 bg-white/25 hover:bg-white/40 transition-colors">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 mb-1">
                      {n.pinned && <Pin className="w-3.5 h-3.5 text-[#750014]" aria-label={t('news.pinned')} />}
                      <span className="text-xs text-gray-600">{formatDate(n.published_at)}</span>
                      <TrackBadge track={n.track_id} />
                    </span>
                    <span className="block text-sm font-normal">{n.title}</span>
                    <span className="text-xs text-gray-600 line-clamp-2 mt-0.5">{n.body}</span>
                    {(likes > 0 || comments > 0) && (
                      <span className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                        {likes > 0 && (
                          <span className="inline-flex items-center gap-1" aria-label={t('news.likesN', { n: likes })}>
                            <Heart className="w-3.5 h-3.5" /> {likes}
                          </span>
                        )}
                        {comments > 0 && (
                          <span className="inline-flex items-center gap-1" aria-label={t('news.commentsN', { n: comments })}>
                            <MessageCircle className="w-3.5 h-3.5" /> {comments}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  {n.photos[0] && (
                    <span className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gray-900/5">
                      {cover && <img src={cover} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </DataState>
    </CardShell>
  )
}
