import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './Modal'
import { ErrorText } from './DataState'
import { useI18n } from '../context/i18nContext'
import { saveOpportunity } from '../lib/opportunityActions'
import { OPPORTUNITY_KINDS, OPPORTUNITY_REGIONS } from '../lib/opportunities'
import { TRACK_IDS } from '../lib/club'
import type { OpportunityKind, OpportunityRegion, OpportunityRow, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, inputClass, labelClass } from '../lib/ui'

const GRADES = [7, 8, 9, 10, 11, 12]
const isHttps = (v: string) => /^https:\/\/\S+$/i.test(v.trim())

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  )
}

/** Staff add or edit a catalog entry; the facts and links go in as written. */
export function OpportunityForm({ entry, onClose }: { entry: OpportunityRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [f, setF] = useState({
    title: entry?.title ?? '',
    kind: entry?.kind ?? ('olympiad' as OpportunityKind),
    region: entry?.region ?? ('kz' as OpportunityRegion),
    tracks: entry?.tracks ?? ([] as TrackId[]),
    grade_min: entry?.grade_min ?? null,
    grade_max: entry?.grade_max ?? null,
    organizer: entry?.organizer ?? '',
    summary: entry?.summary ?? '',
    description: entry?.description ?? '',
    eligibility: entry?.eligibility ?? '',
    team: entry?.team ?? '',
    fee: entry?.fee ?? '',
    how_to_apply: entry?.how_to_apply ?? '',
    url: entry?.url ?? '',
    apply_url: entry?.apply_url ?? '',
    deadline: entry?.deadline ?? '',
    starts_on: entry?.starts_on ?? '',
    ends_on: entry?.ends_on ?? '',
    dates_note: entry?.dates_note ?? '',
    dates_verified: entry?.dates_verified ?? false,
    sources: (entry?.sources ?? []).join('\n'),
    notes: entry?.notes ?? '',
    hidden: entry?.hidden ?? false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }))
  const text = (key: keyof typeof f) => ({
    id: `o-${key}`,
    value: f[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    className: inputClass,
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const sources = f.sources.split(/\s+/).map((s) => s.trim()).filter(Boolean)
    if (!isHttps(f.url) || (f.apply_url.trim() && !isHttps(f.apply_url)) || sources.some((s) => !isHttps(s))) {
      return setError('invalid_link')
    }
    const clean = (v: string) => v.trim() || null
    setBusy(true)
    setError(null)
    const res = await saveOpportunity(entry?.id ?? null, {
      title: f.title.trim(),
      kind: f.kind,
      region: f.region,
      tracks: f.tracks,
      grade_min: f.grade_min,
      grade_max: f.grade_max,
      organizer: clean(f.organizer),
      summary: f.summary.trim(),
      description: clean(f.description),
      eligibility: clean(f.eligibility),
      team: clean(f.team),
      fee: clean(f.fee),
      how_to_apply: clean(f.how_to_apply),
      url: f.url.trim(),
      apply_url: clean(f.apply_url),
      deadline: f.deadline || null,
      starts_on: f.starts_on || null,
      ends_on: f.ends_on || null,
      dates_note: clean(f.dates_note),
      dates_verified: f.dates_verified,
      sources: sources.slice(0, 12),
      notes: clean(f.notes),
      hidden: f.hidden,
    })
    setBusy(false)
    if (res.error) return setError(res.error)
    onClose()
    if (!entry && res.data) navigate(`/opportunities/${res.data}`)
  }

  const gradeSelect = (key: 'grade_min' | 'grade_max', label: string) => (
    <Field id={`o-${key}`} label={label}>
      <select id={`o-${key}`} className={inputClass} value={f[key] ?? ''}
        onChange={(e) => set(key, e.target.value ? Number(e.target.value) : null)}>
        <option value="">—</option>
        {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
    </Field>
  )

  return (
    <Modal title={entry ? t('opp.form.edit') : t('opp.add')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <Field id="o-title" label={t('opp.form.title')}>
          <input {...text('title')} required maxLength={200} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="o-kind" label={t('opp.form.kind')}>
            <select id="o-kind" className={inputClass} value={f.kind} onChange={(e) => set('kind', e.target.value as OpportunityKind)}>
              {OPPORTUNITY_KINDS.map((k) => <option key={k} value={k}>{t(`opp.kind.${k}`)}</option>)}
            </select>
          </Field>
          <Field id="o-region" label={t('opp.form.region')}>
            <select id="o-region" className={inputClass} value={f.region} onChange={(e) => set('region', e.target.value as OpportunityRegion)}>
              {OPPORTUNITY_REGIONS.map((r) => <option key={r} value={r}>{t(`opp.region.${r}`)}</option>)}
            </select>
          </Field>
        </div>
        <fieldset>
          <legend className={labelClass}>{t('opp.form.tracks')}</legend>
          <div className="flex flex-wrap gap-4">
            {TRACK_IDS.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.tracks.includes(id)}
                  onChange={(e) => set('tracks', e.target.checked ? [...f.tracks, id] : f.tracks.filter((x) => x !== id))} />
                {t(`track.${id}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          {gradeSelect('grade_min', t('opp.form.gradeMin'))}
          {gradeSelect('grade_max', t('opp.form.gradeMax'))}
        </div>
        <Field id="o-organizer" label={t('opp.form.organizer')}><input {...text('organizer')} maxLength={400} /></Field>
        <Field id="o-summary" label={t('opp.form.summary')}>
          <textarea {...text('summary')} rows={2} required maxLength={600} />
        </Field>
        <Field id="o-description" label={t('opp.form.description')}>
          <textarea {...text('description')} rows={6} maxLength={6000} />
        </Field>
        <Field id="o-eligibility" label={t('opp.section.who')}><textarea {...text('eligibility')} rows={3} maxLength={2000} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="o-team" label={t('opp.fact.team')}><input {...text('team')} maxLength={600} /></Field>
          <Field id="o-fee" label={t('opp.fact.fee')}><input {...text('fee')} maxLength={800} /></Field>
        </div>
        <Field id="o-how_to_apply" label={t('opp.section.how')}><textarea {...text('how_to_apply')} rows={3} maxLength={2000} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="o-url" label={t('opp.form.url')}><input {...text('url')} type="url" required placeholder="https://" maxLength={500} /></Field>
          <Field id="o-apply_url" label={t('opp.form.applyUrl')}><input {...text('apply_url')} type="url" placeholder="https://" maxLength={500} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field id="o-deadline" label={t('opp.fact.deadline')}><input {...text('deadline')} type="date" /></Field>
          <Field id="o-starts_on" label={t('opp.form.startsOn')}><input {...text('starts_on')} type="date" /></Field>
          <Field id="o-ends_on" label={t('opp.form.endsOn')}><input {...text('ends_on')} type="date" /></Field>
        </div>
        <Field id="o-dates_note" label={t('opp.form.datesNote')} hint={t('opp.form.datesNoteHint')}>
          <textarea {...text('dates_note')} rows={2} maxLength={1500} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.dates_verified} onChange={(e) => set('dates_verified', e.target.checked)} />
          {t('opp.form.verified')}
        </label>
        <Field id="o-sources" label={t('opp.form.sources')} hint={t('opp.form.sourcesHint')}>
          <textarea {...text('sources')} rows={3} />
        </Field>
        <Field id="o-notes" label={t('opp.section.notes')}><textarea {...text('notes')} rows={2} maxLength={2000} /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.hidden} onChange={(e) => set('hidden', e.target.checked)} />
          {t('opp.form.hidden')}
        </label>
        <ErrorText error={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>{t('common.save')}</button>
          <button type="button" onClick={onClose} className={btnSecondary}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}
