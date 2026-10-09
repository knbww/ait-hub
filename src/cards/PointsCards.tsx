import { Link } from 'react-router-dom'
import { Crown, Sparkles } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useLeaderboard, usePointsJournal, usePointsTotal } from '../hooks/usePoints'
import { formatDate } from '../lib/club'

/** The member's own AIT Points: total and the latest confirmed entries. */
export function MyPointsCard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const total = usePointsTotal(profile?.id)
  const journal = usePointsJournal(profile?.id ?? null, Boolean(profile?.id), 3)

  return (
    <CardShell icon={Sparkles} title={t('card.points')} to="/points" linkLabel={t('card.journal')}>
      <DataState isLoading={total.isLoading} error={total.error} onRetry={() => void total.refetch()}>
        <p className="text-4xl font-light leading-none mb-1">{total.data ?? 0}</p>
        <p className="text-xs text-gray-600 mb-3">{t('points.short')}</p>
        {(journal.data ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">{t('points.noneYet')}</p>
        ) : (
          <ul className="space-y-1.5">
            {journal.data!.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{e.note}</span>
                  <span className="block text-xs text-gray-500">{formatDate(e.created_at)}</span>
                </span>
                <span className={e.amount >= 0 ? 'text-green-800' : 'text-red-700'}>
                  {e.amount > 0 ? `+${e.amount}` : e.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </CardShell>
  )
}

/** Top of the AIT Points leaderboard in the member's track (staff: whole club). */
export function LeaderboardCard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const track = profile?.role === 'member' ? (profile.track_id ?? null) : null
  const board = useLeaderboard(track)
  const ranked = (board.data ?? []).filter((r) => r.total > 0)
  const myIndex = ranked.findIndex((r) => r.profile_id === profile?.id)

  return (
    <CardShell icon={Crown} title={track ? t('card.leaderboardTrack', { track: t(`track.${track}.short`) }) : t('card.leaderboard')}
      to="/points" linkLabel={t('card.all')}>
      <DataState isLoading={board.isLoading} error={board.error} onRetry={() => void board.refetch()}
        empty={ranked.length === 0} emptyText={t('points.boardEmpty')}>
        <ol className="space-y-1">
          {ranked.slice(0, 5).map((r, i) => (
            <li key={r.profile_id}>
              <Link to={`/members/${r.profile_id}`}
                className={`flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/40 ${r.profile_id === profile?.id ? 'bg-[#750014]/10' : ''}`}>
                <span className="w-5 text-sm text-gray-500 tabular-nums">{i + 1}</span>
                <Avatar path={r.avatar_path} name={r.full_name} size="sm" />
                <span className="flex-1 truncate text-sm">{r.full_name}</span>
                <span className="text-sm font-medium tabular-nums">{r.total}</span>
              </Link>
            </li>
          ))}
        </ol>
        {myIndex >= 5 && (
          <p className="text-xs text-gray-600 mt-2">{t('points.myPlace', { n: myIndex + 1 })}</p>
        )}
      </DataState>
    </CardShell>
  )
}
