import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CalendarClock, ExternalLink, Eye, EyeOff, Info, Pencil, Send, Trash2 } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { LinkifiedText } from '../components/LinkifiedText'
import { TrackBadge } from '../components/TrackBadge'
import { DeadlineChip, OpportunityBadges, SaveButton } from '../components/OpportunityBits'
import { OpportunityForm } from '../components/OpportunityForm'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useOpportunities, useOpportunitySavers } from '../hooks/useOpportunities'
import { deleteOpportunity, setOpportunityHidden } from '../lib/opportunityActions'
import { gradeLabel, hostOf } from '../lib/opportunities'
import { formatDay } from '../lib/club'
import type { OpportunityRow } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, sectionTitle } from '../lib/ui'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/30 p-3">
      <dt className="text-xs text-gray-600 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  )
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null
  return (
    <section>
      <h2 className={`${sectionTitle} mb-2`}>{title}</h2>
      <LinkifiedText text={text} className="text-sm text-gray-800 leading-relaxed" />
    </section>
  )
}

function dateRange(o: OpportunityRow): string | null {
  if (o.starts_on && o.ends_on && o.starts_on !== o.ends_on) return `${formatDay(o.starts_on)} – ${formatDay(o.ends_on)}`
  if (o.starts_on) return formatDay(o.starts_on)
  if (o.ends_on) return formatDay(o.ends_on)
  return null
}

function StaffTools({ o }: { o: OpportunityRow }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const savers = useOpportunitySavers(o.id, true)

  const run = async (fn: () => Promise<{ error: unknown }>, after?: () => void) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) return setError(res.error)
    after?.()
  }

  return (
    <GlassCard>
      <h2 className={`${sectionTitle} mb-3`}>{t('opp.staff.title')}</h2>
      <p className="text-sm text-gray-700 mb-3">
        {savers.data?.length
          ? t('opp.staff.savers', { names: savers.data.map((s) => s.profile?.full_name).join(', ') })
          : t('opp.staff.noSavers')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setEditing(true)} className={`${btnSmall} border border-gray-900/30 bg-white/40`}>
          <Pencil className="w-3.5 h-3.5" /> {t('common.edit')}
        </button>
        <button disabled={busy} onClick={() => void run(() => setOpportunityHidden(o.id, !o.hidden))}
          className={`${btnSmall} border border-gray-900/30 bg-white/40`}>
          {o.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {o.hidden ? t('opp.staff.show') : t('opp.staff.hide')}
        </button>
        <button disabled={busy}
          onClick={() => window.confirm(t('opp.staff.deleteConfirm')) && void run(() => deleteOpportunity(o.id), () => navigate('/opportunities'))}
          className={`${btnSmall} border border-red-600/50 text-red-700`}>
          <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
        </button>
      </div>
      <ErrorText error={error} />
      {editing && <OpportunityForm entry={o} onClose={() => setEditing(false)} />}
    </GlassCard>
  )
}

export function OpportunityPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const { isStaff } = useAuth()
  const opportunities = useOpportunities()
  const o = opportunities.data?.find((x) => x.id === id)
  const range = o ? dateRange(o) : null
  const grades = o ? gradeLabel(o) : null

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <Link to="/opportunities" className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 px-1">
        <ArrowLeft className="w-4 h-4" /> {t('opp.back')}
      </Link>
      <DataState isLoading={opportunities.isLoading} error={opportunities.error} onRetry={() => void opportunities.refetch()}
        empty={!o} emptyText={<GlassCard><p className="text-sm text-gray-700">{t('opp.notFound')}</p></GlassCard>}>
        {o && (
          <>
            <GlassCard>
              <div className="flex items-start justify-between gap-3 mb-3">
                <OpportunityBadges o={o} />
                <SaveButton o={o} withLabel />
              </div>
              <h1 className="text-2xl sm:text-3xl font-light leading-tight">{o.title}</h1>
              {o.organizer && <p className="text-sm text-gray-600 mt-2">{o.organizer}</p>}
              <p className="text-base text-gray-900 mt-4">{o.summary}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-4">
                <DeadlineChip o={o} large />
                {o.tracks.map((track) => <TrackBadge key={track} track={track} short={false} />)}
              </div>
              <div className="flex flex-wrap gap-2 mt-5">
                {o.apply_url && (
                  <a href={o.apply_url} target="_blank" rel="noreferrer" className={btnPrimary}>
                    <Send className="w-4 h-4" /> {t('opp.apply')}
                  </a>
                )}
                <a href={o.url} target="_blank" rel="noreferrer" className={o.apply_url ? btnSecondary : btnPrimary}>
                  <ExternalLink className="w-4 h-4" /> {t('opp.site')}
                </a>
              </div>
            </GlassCard>

            <GlassCard>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Fact label={t('opp.fact.deadline')}>{o.deadline ? formatDay(o.deadline) : t('opp.fact.seeNote')}</Fact>
                <Fact label={t('opp.fact.dates')}>{range ?? t('opp.fact.seeNote')}</Fact>
                <Fact label={t('opp.fact.grades')}>{grades ?? t('opp.fact.seeEligibility')}</Fact>
                {o.team && <Fact label={t('opp.fact.team')}>{o.team}</Fact>}
                {o.fee && <Fact label={t('opp.fact.fee')}>{o.fee}</Fact>}
              </dl>
              {o.dates_note && (
                <div className="flex gap-2.5 mt-3 rounded-2xl border border-white/60 bg-white/40 p-3 text-sm text-gray-800">
                  {o.dates_verified
                    ? <BadgeCheck className="w-5 h-5 shrink-0 text-emerald-700" aria-hidden="true" />
                    : <CalendarClock className="w-5 h-5 shrink-0 text-amber-700" aria-hidden="true" />}
                  <div>
                    <p className="text-xs font-medium mb-0.5">{o.dates_verified ? t('opp.verified') : t('opp.unverified')}</p>
                    <LinkifiedText text={o.dates_note} />
                  </div>
                </div>
              )}
            </GlassCard>

            <GlassCard className="space-y-5">
              <Section title={t('opp.section.about')} text={o.description} />
              <Section title={t('opp.section.who')} text={o.eligibility} />
              <Section title={t('opp.section.how')} text={o.how_to_apply} />
              {o.notes && (
                <section className="flex gap-2.5 rounded-2xl bg-[#750014]/5 border border-[#750014]/15 p-3">
                  <Info className="w-5 h-5 shrink-0 text-[#750014]" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-medium mb-0.5">{t('opp.section.notes')}</h2>
                    <LinkifiedText text={o.notes} className="text-sm text-gray-800" />
                  </div>
                </section>
              )}
              {o.sources.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-700 hover:text-gray-900">{t('opp.sources', { n: o.sources.length })}</summary>
                  <ul className="mt-2 space-y-1">
                    {o.sources.map((s) => (
                      <li key={s}>
                        <a href={s} target="_blank" rel="noreferrer" className="underline text-gray-700 break-all">{hostOf(s)}</a>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-600 mt-2">{t('opp.checked', { date: formatDay(o.updated_at.slice(0, 10)) })}</p>
                </details>
              )}
            </GlassCard>

            {isStaff && <StaffTools o={o} />}
          </>
        )}
      </DataState>
    </motion.div>
  )
}
