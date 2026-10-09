import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, Trash2 } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { EventLine } from '../components/EventLine'
import { Avatar } from '../components/Avatar'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMembers } from '../hooks/useClub'
import { useEventResults, useEvents, useTeamRating, useTrackRating } from '../hooks/useEvents'
import { useTeams } from '../hooks/useTeams'
import { deleteResult, saveResult, setEventStatus } from '../lib/eventActions'
import { TRACK_IDS, notOver } from '../lib/club'
import type { EventRow, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, inputClass, labelClass, pageTitle, sectionTitle, segment } from '../lib/ui'

function ResultsEditor({ event }: { event: EventRow }) {
  const { t } = useI18n()
  const results = useEventResults(event.id)
  const members = useMembers()
  const teams = useTeams()
  const [subject, setSubject] = useState('')
  const [place, setPlace] = useState('')
  const [score, setScore] = useState('')
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const used = new Set((results.data ?? []).map((r) => r.profile_id ?? r.team_id))
  const memberOptions = (members.data ?? []).filter((m) => m.status === 'active' && m.role === 'member' && !used.has(m.id))
  const teamOptions = (teams.data ?? []).filter((tm) => tm.track_id === event.track_id && !used.has(tm.id))

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const [kind, id] = subject.split(':')
    const value = Number(delta)
    if (!id || !Number.isInteger(value)) return setError('invalid_amount')
    setBusy(true)
    setError(null)
    const res = await saveResult(null, {
      event_id: event.id,
      profile_id: kind === 'p' ? id : null,
      team_id: kind === 't' ? id : null,
      place: place ? Number(place) : null,
      score: score ? Number(score) : null,
      rating_delta: value,
      note: note.trim() || null,
    })
    setBusy(false)
    if (res.error) return setError(res.error)
    setSubject('')
    setPlace('')
    setScore('')
    setDelta('')
    setNote('')
  }

  const publish = async () => {
    if (!window.confirm(t('rating.publishConfirm'))) return
    setBusy(true)
    const res = await setEventStatus(event.id, 'completed')
    setBusy(false)
    setError(res.error)
  }

  return (
    <div className="space-y-4">
      <DataState isLoading={results.isLoading} error={results.error} onRetry={() => void results.refetch()}
        empty={(results.data ?? []).length === 0} emptyText={t('rating.noResultsYet')}>
        <ul className="divide-y divide-white/50">
          {(results.data ?? []).map((r) => (
            <li key={r.id} className="py-2 flex items-center gap-3 text-sm">
              <span className="w-8 text-gray-500">{r.place ?? '—'}</span>
              <span className="flex-1 truncate">{r.profile?.full_name ?? r.team?.name}</span>
              {r.score !== null && <span className="text-gray-600">{r.score}</span>}
              <span className="w-12 text-right font-medium">{r.rating_delta > 0 ? `+${r.rating_delta}` : r.rating_delta}</span>
              <button onClick={() => void deleteResult(r.id)} aria-label={t('common.delete')} className="p-2 rounded-lg hover:bg-white/50">
                <Trash2 className="w-4 h-4 text-red-700" />
              </button>
            </li>
          ))}
        </ul>
      </DataState>

      <form onSubmit={add} className="rounded-2xl border border-white/70 bg-white/40 p-3 space-y-2">
        <p className="text-sm font-medium">{t('rating.addResult')}</p>
        <select className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} required>
          <option value="" disabled>{t('rating.pickSubject')}</option>
          {teamOptions.length > 0 && (
            <optgroup label={t('rating.teams')}>
              {teamOptions.map((tm) => <option key={tm.id} value={`t:${tm.id}`}>{tm.name}</option>)}
            </optgroup>
          )}
          <optgroup label={t('rating.members')}>
            {memberOptions.map((m) => <option key={m.id} value={`p:${m.id}`}>{m.full_name}</option>)}
          </optgroup>
        </select>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelClass}>{t('rating.place')}</label>
            <input className={inputClass} type="number" min={1} inputMode="numeric" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t('rating.score')}</label>
            <input className={inputClass} type="number" step="any" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t('rating.delta')}</label>
            <input className={inputClass} type="number" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} required />
          </div>
        </div>
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('rating.notePlaceholder')} maxLength={300} />
        <p className="text-xs text-gray-600">{t('rating.deltaHint')}</p>
        {error === 'invalid_amount' ? <p className="text-sm text-red-700">{t('rating.badDelta')}</p> : <ErrorText error={error} />}
        <button type="submit" disabled={busy} className={btnSecondary}>{t('rating.addButton')}</button>
      </form>

      <button onClick={publish} disabled={busy || (results.data ?? []).length === 0} className={btnPrimary}>
        {t('rating.publish')}
      </button>
    </div>
  )
}

function EventResults({ event, canEdit }: { event: EventRow; canEdit: boolean }) {
  const { t } = useI18n()
  const results = useEventResults(event.status === 'completed' ? event.id : null)
  const started = !notOver(event.starts_at, null)
  const rulesInAdvance = Boolean(event.rules_published_at && Date.parse(event.rules_published_at) < Date.parse(event.starts_at))

  return (
    <div className="mt-3 space-y-3">
      {event.rules_url && (
        <a href={event.rules_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
          <ExternalLink className="w-3 h-3" /> {t('calendar.rulesLink')}
        </a>
      )}
      {event.rules && <p className="text-sm whitespace-pre-wrap">{event.rules}</p>}
      {event.status === 'completed' ? (
        <DataState isLoading={results.isLoading} error={results.error} onRetry={() => void results.refetch()}
          empty={(results.data ?? []).length === 0} emptyText={t('rating.noResults')}>
          <ol className="divide-y divide-white/50">
            {(results.data ?? []).map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="w-8 text-gray-500">{r.place ?? '—'}</span>
                <span className="flex-1 truncate">
                  {r.profile_id ? <Link to={`/members/${r.profile_id}`} className="hover:underline">{r.profile?.full_name}</Link> : r.team?.name}
                </span>
                {r.score !== null && <span className="text-gray-600">{r.score}</span>}
                <span className="w-12 text-right font-medium">{r.rating_delta > 0 ? `+${r.rating_delta}` : r.rating_delta}</span>
              </li>
            ))}
          </ol>
        </DataState>
      ) : canEdit && started ? (
        rulesInAdvance ? <ResultsEditor event={event} /> : <p className="text-sm text-red-700">{t('errors.rules_not_announced_in_advance')}</p>
      ) : (
        <p className="text-sm text-gray-600">{started ? t('rating.awaiting') : t('rating.upcoming')}</p>
      )}
    </div>
  )
}

export function RatingPage() {
  const { t } = useI18n()
  const { profile, isOversight, role } = useAuth()
  const [params, setParams] = useSearchParams()
  const paramTrack = params.get('track') as TrackId | null
  const track: TrackId = paramTrack && TRACK_IDS.includes(paramTrack) ? paramTrack : (profile?.track_id ?? 'ai')
  const selectedEvent = params.get('event')
  const members = useTrackRating(track)
  const teams = useTeamRating(track)
  const events = useEvents()
  const canEdit = isOversight || (role === 'track_lead' && profile?.track_id === track)

  const rated = (events.data ?? []).filter((e) => e.is_rated && e.track_id === track && e.status !== 'draft' && e.status !== 'cancelled')
  const select = (next: Record<string, string>) => setParams(next, { replace: true })

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-5xl mx-auto space-y-4">
      <GlassCard>
        <h1 className={pageTitle}>{t('rating.title')}</h1>
        <p className="text-sm text-gray-700 mt-1 mb-3">{t('rating.intro')}</p>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          {TRACK_IDS.map((id) => (
            <button key={id} className={segment(id === track)} onClick={() => select({ track: id })}>{t(`track.${id}`)}</button>
          ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <GlassCard>
          <h2 className={sectionTitle}>{t('rating.members')}</h2>
          <div className="mt-3">
            <DataState isLoading={members.isLoading} error={members.error} onRetry={() => void members.refetch()}
              empty={(members.data ?? []).length === 0} emptyText={t('rating.empty')}>
              <ol className="space-y-1">
                {(members.data ?? []).map((r, i) => (
                  <li key={r.profile_id}>
                    <Link to={`/members/${r.profile_id}`}
                      className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/40 ${r.profile_id === profile?.id ? 'bg-[#750014]/10' : ''}`}>
                      <span className="w-6 text-sm text-gray-500">{i + 1}</span>
                      <Avatar path={r.avatar_path} name={r.full_name} size="sm" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm">{r.full_name}</span>
                        <span className="block text-xs text-gray-600">
                          {t('rating.stats', { events: r.events, best: r.best_place ?? '—' })}
                        </span>
                      </span>
                      <span className="text-sm font-medium tabular-nums">{r.rating}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </DataState>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className={sectionTitle}>{t('rating.teams')}</h2>
          <div className="mt-3">
            <DataState isLoading={teams.isLoading} error={teams.error} onRetry={() => void teams.refetch()}
              empty={(teams.data ?? []).length === 0} emptyText={t('rating.teamsEmpty')}>
              <ol className="space-y-1">
                {(teams.data ?? []).map((r, i) => (
                  <li key={r.team_id} className="flex items-center gap-3 px-2 py-2">
                    <span className="w-6 text-sm text-gray-500">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm">{r.name}</span>
                      <span className="block text-xs text-gray-600">{t('rating.stats', { events: r.events, best: r.best_place ?? '—' })}</span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">{r.rating}</span>
                  </li>
                ))}
              </ol>
            </DataState>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className={sectionTitle}>{t('rating.events')}</h2>
        <div className="mt-3">
          <DataState isLoading={events.isLoading} error={events.error} onRetry={() => void events.refetch()}
            empty={rated.length === 0} emptyText={t('rating.noEvents')}>
            <ul className="space-y-3">
              {[...rated].reverse().map((e) => (
                <li key={e.id}>
                  <button className="w-full text-left" onClick={() => select(selectedEvent === e.id ? { track } : { track, event: e.id })}>
                    <EventLine event={e} />
                  </button>
                  {selectedEvent === e.id && <EventResults event={e} canEdit={canEdit} />}
                </li>
              ))}
            </ul>
          </DataState>
        </div>
      </GlassCard>
    </motion.div>
  )
}
