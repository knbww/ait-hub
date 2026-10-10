import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Crown } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState } from '../components/DataState'
import { Avatar } from '../components/Avatar'
import { TrackBadge } from '../components/TrackBadge'
import { RatingChart } from '../components/RatingChart'
import { pageVariants } from '../lib/animations'
import { useI18n } from '../context/i18nContext'
import { useTeamRating } from '../hooks/useEvents'
import { useProjects, useTeamResults, useTeams } from '../hooks/useTeams'
import { formatDate } from '../lib/club'
import { toRatingPoints } from '../lib/rating'
import type { TeamRow } from '../lib/db'
import { pageTitle, sectionTitle } from '../lib/ui'

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <GlassCard className="!p-4">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-3xl font-light leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </GlassCard>
  )
}

function TeamProfile({ team }: { team: TeamRow }) {
  const { t } = useI18n()
  const results = useTeamResults(team.id)
  const ratings = useTeamRating(team.track_id)
  const projects = useProjects()
  const index = (ratings.data ?? []).findIndex((r) => r.team_id === team.id)
  const rows = results.data ?? []
  const places = rows.map((r) => r.place).filter((n): n is number => n !== null)
  const members = team.team_members ?? []
  const teamProjects = (projects.data ?? []).filter((p) => p.team_id === team.id)

  const points = toRatingPoints(rows)

  return (
    <>
      <GlassCard>
        <h1 className={pageTitle}>{team.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-700">
          <TrackBadge track={team.track_id} short={false} />
          <span>{t('teams.count', { n: members.length, max: 5 })}</span>
        </div>
        {team.goal && <p className="text-sm text-gray-800 mt-2">{team.goal}</p>}
      </GlassCard>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label={t('team.stat.rating')} value={index >= 0 ? ratings.data![index].rating : '—'}
          sub={index >= 0 ? t('member.stat.place', { n: index + 1, total: ratings.data!.length }) : undefined} />
        <Tile label={t('member.stat.events')} value={rows.length} />
        <Tile label={t('member.stat.best')} value={places.length ? t('member.place', { n: Math.min(...places) }) : '—'} />
        <Tile label={t('team.stat.projects')} value={teamProjects.length} />
      </div>

      {points.length > 0 && (
        <GlassCard>
          <h2 className={`${sectionTitle} mb-2`}>{t('team.chart')}</h2>
          <RatingChart points={points} label={t('team.chartAria', { name: team.name })} />
        </GlassCard>
      )}

      <GlassCard>
        <h2 className={sectionTitle}>{t('team.members')}</h2>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {members.map((m) => (
            <li key={m.profile_id}>
              <Link to={`/members/${m.profile_id}`}
                className="flex items-center gap-3 p-2.5 rounded-2xl border border-white/60 bg-white/30 hover:bg-white/50">
                <Avatar path={m.profile?.avatar_path ?? null} name={m.profile?.full_name ?? '?'} size="sm" />
                <span className="flex-1 min-w-0 truncate text-sm">{m.profile?.full_name}</span>
                {m.profile_id === team.captain_id && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#750014]"><Crown className="w-3.5 h-3.5" /> {t('team.captain')}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard>
        <h2 className={sectionTitle}>{t('member.results')}</h2>
        <DataState isLoading={results.isLoading} error={results.error} onRetry={() => void results.refetch()}
          empty={rows.length === 0} emptyText={t('team.noResults')}>
          <ul className="divide-y divide-white/60 mt-2">
            {rows.map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="w-24 text-gray-700 whitespace-nowrap">{r.event ? formatDate(r.event.starts_at) : '—'}</span>
                <span className="flex-1 min-w-0 truncate">{r.event?.title}</span>
                <span className="text-gray-600 whitespace-nowrap">{r.place ? t('member.place', { n: r.place }) : '—'}</span>
                <span className={`w-12 text-right font-medium ${r.rating_delta < 0 ? 'text-red-700' : 'text-green-800'}`}>
                  {r.rating_delta > 0 ? `+${r.rating_delta}` : r.rating_delta}
                </span>
              </li>
            ))}
          </ul>
        </DataState>
      </GlassCard>

      {teamProjects.length > 0 && (
        <GlassCard>
          <h2 className={sectionTitle}>{t('card.projects')}</h2>
          <ul className="mt-2 space-y-1">
            {teamProjects.map((p) => (
              <li key={p.id}><Link to={`/projects/${p.id}`} className="text-sm underline">{p.title}</Link></li>
            ))}
          </ul>
        </GlassCard>
      )}
    </>
  )
}

export function TeamPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const teams = useTeams()
  const team = (teams.data ?? []).find((tm) => tm.id === id)

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <Link to="/teams" className="inline-flex items-center gap-1 text-sm text-gray-700 px-1">
        <ArrowLeft className="w-4 h-4" /> {t('nav.teams')}
      </Link>
      <DataState isLoading={teams.isLoading} error={teams.error} onRetry={() => void teams.refetch()}
        empty={!team} emptyText={<GlassCard><p className="text-sm">{t('team.notFound')}</p></GlassCard>}>
        {team && <TeamProfile team={team} />}
      </DataState>
    </motion.div>
  )
}
