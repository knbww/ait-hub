import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronDown, ExternalLink, Plus } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { EventLine } from '../components/EventLine'
import { Modal } from '../components/Modal'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useEvents } from '../hooks/useEvents'
import { useMembers } from '../hooks/useClub'
import { deleteEvent, saveEvent, setEventStatus } from '../lib/eventActions'
import type { EventInput } from '../lib/eventActions'
import {
  EVENT_TRACK, EVENT_TYPES, RATED_TYPES, TRACK_IDS, formatDateTime, formatMonth, fromLocalInput, notOver, toLocalInput,
} from '../lib/club'
import type { EventRow, EventStatus, EventType, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, inputClass, labelClass, pageTitle, segment } from '../lib/ui'

function EventForm({ event, onClose }: { event: EventRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const { profile, isOversight } = useAuth()
  const members = useMembers()
  const leadTrack = isOversight ? null : (profile?.track_id ?? null)

  const [type, setType] = useState<EventType>(event?.type ?? (leadTrack === 'algo' ? 'contest' : leadTrack === 'ai' ? 'tournament' : leadTrack === 'startup' ? 'pitch_review' : 'workshop'))
  const [title, setTitle] = useState(event?.title ?? '')
  const [track, setTrack] = useState<TrackId | ''>(event?.track_id ?? leadTrack ?? '')
  const [startsAt, setStartsAt] = useState(event ? toLocalInput(event.starts_at) : '')
  const [endsAt, setEndsAt] = useState(event?.ends_at ? toLocalInput(event.ends_at) : '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [responsible, setResponsible] = useState(event?.responsible_id ?? profile?.id ?? '')
  const [rated, setRated] = useState(event ? event.is_rated : true)
  const [rules, setRules] = useState(event?.rules ?? '')
  const [rulesUrl, setRulesUrl] = useState(event?.rules_url ?? '')
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'draft')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const fixedTrack = EVENT_TRACK[type]
  const canRate = RATED_TYPES.includes(type)
  const effectiveTrack: TrackId | null = fixedTrack ?? (track || null)
  const types = isOversight ? EVENT_TYPES : EVENT_TYPES.filter((ty) => !EVENT_TRACK[ty] || EVENT_TRACK[ty] === leadTrack)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (rulesUrl.trim() && !/^https:\/\//i.test(rulesUrl.trim())) return setError('invalid_link')
    setBusy(true)
    setError(null)
    const input: EventInput = {
      type,
      title: title.trim() || t(`event.type.${type}`),
      track_id: effectiveTrack,
      starts_at: fromLocalInput(startsAt),
      ends_at: endsAt ? fromLocalInput(endsAt) : null,
      location: location.trim() || null,
      description: description.trim() || null,
      responsible_id: responsible || null,
      is_rated: canRate && rated,
      rules: canRate && rated ? rules.trim() || null : null,
      rules_url: canRate && rated ? rulesUrl.trim() || null : null,
      status,
    }
    const res = await saveEvent(event?.id ?? null, input)
    setBusy(false)
    if (res.error) return setError(res.error)
    onClose()
  }

  return (
    <Modal title={event ? t('calendar.edit') : t('calendar.add')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('calendar.form.type')}</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as EventType)}>
              {types.map((ty) => <option key={ty} value={ty}>{t(`event.type.${ty}`)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('calendar.form.track')}</label>
            <select className={inputClass} value={fixedTrack ?? track} disabled={Boolean(fixedTrack) || !isOversight}
              onChange={(e) => setTrack(e.target.value as TrackId | '')}>
              {isOversight && <option value="">{t('track.all')}</option>}
              {TRACK_IDS.map((id) => <option key={id} value={id}>{t(`track.${id}`)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('calendar.form.title')}</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160}
            placeholder={t(`event.type.${type}`)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('calendar.form.starts')}</label>
            <input className={inputClass} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t('calendar.form.ends')}</label>
            <input className={inputClass} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('calendar.form.location')}</label>
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className={labelClass}>{t('calendar.form.responsible')}</label>
            <select className={inputClass} value={responsible} onChange={(e) => setResponsible(e.target.value)}>
              <option value="">—</option>
              {(members.data ?? []).filter((m) => m.status === 'active').map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('calendar.form.description')}</label>
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
        </div>
        {canRate && (
          <div className="rounded-2xl border border-white/70 bg-white/40 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} />
              {t('calendar.form.rated')}
            </label>
            {rated && (
              <>
                <textarea className={inputClass} rows={4} value={rules} onChange={(e) => setRules(e.target.value)}
                  placeholder={t('calendar.form.rules')} maxLength={8000} />
                <input className={inputClass} type="url" value={rulesUrl} onChange={(e) => setRulesUrl(e.target.value)}
                  placeholder={t('calendar.form.rulesUrl')} />
                <p className="text-xs text-gray-600">{t('calendar.form.ratedHint')}</p>
              </>
            )}
          </div>
        )}
        <fieldset>
          <legend className={labelClass}>{t('calendar.form.status')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['draft', 'confirmed'] as const).map((s) => (
              <button type="button" key={s} onClick={() => setStatus(s)} className={segment(status === s)}>
                {t(`event.status.${s}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-1">{t('calendar.form.statusHint')}</p>
        </fieldset>
        <ErrorText error={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>{t('common.save')}</button>
          <button type="button" onClick={onClose} className={btnSecondary}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}

function EventItem({ event, canEdit, onEdit }: { event: EventRow; canEdit: boolean; onEdit: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const hasDetails = Boolean(event.description || event.rules || event.rules_url) || canEdit
  const started = !notOver(event.starts_at, null)

  const act = async (fn: () => Promise<{ error: unknown }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    setError(res.error)
  }

  return (
    <li>
      <div className="relative">
        <EventLine event={event} />
        {hasDetails && (
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t('calendar.details')}
            className="absolute top-2 right-2 p-2 rounded-lg hover:bg-white/50">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 ml-2 pl-3 border-l-2 border-white/70 space-y-3 text-sm">
          {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
          {event.is_rated && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                {t('calendar.rules')}
                {event.rules_published_at && ` · ${t('calendar.rulesPublished', { date: formatDateTime(event.rules_published_at) })}`}
              </p>
              {event.rules && <p className="whitespace-pre-wrap">{event.rules}</p>}
              {event.rules_url && (
                <a href={event.rules_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  <ExternalLink className="w-3 h-3" /> {t('calendar.rulesLink')}
                </a>
              )}
              {event.status === 'completed' && (
                <Link to={`/rating?track=${event.track_id}&event=${event.id}`} className="block underline mt-1">
                  {t('calendar.results')}
                </Link>
              )}
            </div>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {event.status !== 'completed' && (
                <button onClick={onEdit} className={`${btnSmall} border border-gray-900/30 bg-white/40`}>{t('common.edit')}</button>
              )}
              {event.status === 'draft' && (
                <>
                  <button disabled={busy} onClick={() => act(() => setEventStatus(event.id, 'confirmed'))}
                    className={`${btnSmall} bg-gray-900 text-white`}>{t('calendar.confirm')}</button>
                  <button disabled={busy} onClick={() => act(() => deleteEvent(event.id), t('calendar.deleteConfirm'))}
                    className={`${btnSmall} border border-red-600/50 text-red-700`}>{t('common.delete')}</button>
                </>
              )}
              {event.status === 'confirmed' && (
                <>
                  {event.is_rated && started ? (
                    <Link to={`/rating?track=${event.track_id}&event=${event.id}`} className={`${btnSmall} bg-gray-900 text-white`}>
                      {t('calendar.enterResults')}
                    </Link>
                  ) : (
                    started && (
                      <button disabled={busy} onClick={() => act(() => setEventStatus(event.id, 'completed'))}
                        className={`${btnSmall} bg-gray-900 text-white`}>{t('calendar.complete')}</button>
                    )
                  )}
                  <button disabled={busy} onClick={() => act(() => setEventStatus(event.id, 'cancelled'), t('calendar.cancelConfirm'))}
                    className={`${btnSmall} border border-red-600/50 text-red-700`}>{t('calendar.cancel')}</button>
                </>
              )}
              {event.status === 'cancelled' && (
                <button disabled={busy} onClick={() => act(() => setEventStatus(event.id, 'draft'))}
                  className={`${btnSmall} border border-gray-900/30 bg-white/40`}>{t('calendar.restore')}</button>
              )}
            </div>
          )}
          <ErrorText error={error} />
        </div>
      )}
    </li>
  )
}

export function CalendarPage() {
  const { t } = useI18n()
  const { profile, isStaff, isOversight } = useAuth()
  const events = useEvents()
  const [filter, setFilter] = useState<'all' | TrackId>('all')
  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState<EventRow | null | 'new'>(null)

  const canEdit = (e: EventRow) => isOversight || (isStaff && !!e.track_id && e.track_id === profile?.track_id)
  const list = (events.data ?? [])
    .filter((e) => filter === 'all' || e.track_id === filter || e.track_id === null)
    .filter((e) => (showPast ? !notOver(e.starts_at, e.ends_at) : notOver(e.starts_at, e.ends_at)))
  const ordered = showPast ? [...list].reverse() : list

  const groups: { month: string; items: EventRow[] }[] = []
  for (const e of ordered) {
    const month = formatMonth(e.starts_at)
    const last = groups[groups.length - 1]
    if (last?.month === month) last.items.push(e)
    else groups.push({ month, items: [e] })
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h1 className={pageTitle}>{t('calendar.title')}</h1>
          {isStaff && (
            <button onClick={() => setEditing('new')} className={btnPrimary}>
              <Plus className="w-4 h-4" /> {t('calendar.add')}
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button className={segment(filter === 'all')} onClick={() => setFilter('all')}>{t('track.all')}</button>
          {TRACK_IDS.map((id) => (
            <button key={id} className={segment(filter === id)} onClick={() => setFilter(id)}>{t(`track.${id}.short`)}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm mt-3">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          {t('calendar.showPast')}
        </label>
        <p className="text-xs text-gray-600 mt-3">{t('calendar.note')}</p>
      </GlassCard>

      <DataState isLoading={events.isLoading} error={events.error} onRetry={() => void events.refetch()}
        empty={groups.length === 0} emptyText={<GlassCard><p className="text-sm text-gray-700">{showPast ? t('calendar.noPast') : t('events.none')}</p></GlassCard>}>
        {groups.map((g) => (
          <GlassCard key={g.month}>
            <h2 className="text-lg font-light mb-3">{g.month}</h2>
            <ul className="space-y-2">
              {g.items.map((e) => (
                <EventItem key={e.id} event={e} canEdit={canEdit(e)} onEdit={() => setEditing(e)} />
              ))}
            </ul>
          </GlassCard>
        ))}
      </DataState>

      {editing && <EventForm event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </motion.div>
  )
}
