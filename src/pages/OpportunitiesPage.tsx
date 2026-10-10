import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState } from '../components/DataState'
import { TrackBadge } from '../components/TrackBadge'
import { DeadlineChip, OpportunityBadges, SaveButton } from '../components/OpportunityBits'
import { OpportunityForm } from '../components/OpportunityForm'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMySaves, useOpportunities } from '../hooks/useOpportunities'
import { OPPORTUNITY_KINDS, OPPORTUNITY_REGIONS, byUrgency, deadlineState, gradeLabel, suits } from '../lib/opportunities'
import { TRACK_IDS } from '../lib/club'
import type { OpportunityKind, OpportunityRegion, OpportunityRow, TrackId } from '../lib/db'
import { btnPrimary, chip, inputClass, pageTitle, segment } from '../lib/ui'

function OpportunityCard({ o }: { o: OpportunityRow }) {
  const grades = gradeLabel(o)
  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="group relative flex flex-col gap-2 rounded-3xl border-2 border-white/80 bg-white/30 backdrop-blur-[40px] p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(31,38,135,0.12)] hover:bg-white/45 hover:-translate-y-0.5 transition-[background-color,transform]">
      <div className="flex items-start justify-between gap-2">
        <OpportunityBadges o={o} />
        <span className="relative z-10 -mt-1 -mr-1"><SaveButton o={o} /></span>
      </div>
      <h2 className="text-base sm:text-lg font-normal leading-snug">
        {/* The whole card opens the entry; the bookmark sits above this link. */}
        <Link to={`/opportunities/${o.id}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none">
          {o.title}
        </Link>
      </h2>
      {o.organizer && <p className="text-xs text-gray-600 line-clamp-1">{o.organizer}</p>}
      <p className="text-sm text-gray-800 line-clamp-3">{o.summary}</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
        <DeadlineChip o={o} />
        {grades && <span className={`${chip} bg-gray-900/5 text-gray-700`}>{grades}</span>}
        {o.tracks.map((track) => <TrackBadge key={track} track={track} />)}
      </div>
    </motion.article>
  )
}

export function OpportunitiesPage() {
  const { t, tp } = useI18n()
  const { profile, isStaff } = useAuth()
  const opportunities = useOpportunities()
  const saves = useMySaves(profile?.id)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<OpportunityKind | 'all'>('all')
  const [track, setTrack] = useState<TrackId | 'all'>('all')
  const [region, setRegion] = useState<OpportunityRegion | 'all'>('all')
  const [forMe, setForMe] = useState(!isStaff)
  const [openOnly, setOpenOnly] = useState(true)
  const [savedOnly, setSavedOnly] = useState(false)
  const [adding, setAdding] = useState(false)

  const all = useMemo(() => opportunities.data ?? [], [opportunities.data])
  const kinds = OPPORTUNITY_KINDS.filter((k) => all.some((o) => o.kind === k))
  const list = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return all
      .filter((o) => kind === 'all' || o.kind === kind)
      .filter((o) => track === 'all' || o.tracks.includes(track))
      .filter((o) => region === 'all' || o.region === region)
      .filter((o) => !forMe || suits(o, profile))
      .filter((o) => !openOnly || deadlineState(o).kind !== 'closed')
      .filter((o) => !savedOnly || saves.data?.has(o.id))
      .filter((o) => {
        if (!words.length) return true
        const text = `${o.title} ${o.organizer ?? ''} ${o.summary}`.toLowerCase()
        return words.every((w) => text.includes(w))
      })
      .sort(byUrgency)
  }, [all, kind, track, region, forMe, openOnly, savedOnly, query, profile, saves.data])

  const toggle = (active: boolean, onClick: () => void, label: string) => (
    <button type="button" onClick={onClick} aria-pressed={active} className={segment(active)}>{label}</button>
  )

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-6xl mx-auto space-y-4">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h1 className={pageTitle}>{t('opp.title')}</h1>
            <p className="text-sm text-gray-700 mt-1 max-w-2xl">{t('opp.intro')}</p>
          </div>
          {isStaff && (
            <button onClick={() => setAdding(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> {t('opp.add')}
            </button>
          )}
        </div>

        <div className="relative mt-4">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('opp.search')}
            aria-label={t('opp.search')} className={`${inputClass} pl-10 pr-10`} />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-900">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mt-3 -mx-1 px-1">
          {toggle(kind === 'all', () => setKind('all'), t('opp.allKinds'))}
          {kinds.map((k) => (
            <span key={k}>{toggle(kind === k, () => setKind(k), t(`opp.kinds.${k}`))}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {toggle(track === 'all', () => setTrack('all'), t('track.all'))}
            {TRACK_IDS.map((id) => <span key={id}>{toggle(track === id, () => setTrack(id), t(`track.${id}.short`))}</span>)}
          </div>
          <select value={region} onChange={(e) => setRegion(e.target.value as OpportunityRegion | 'all')}
            aria-label={t('opp.regionLabel')} className={`${inputClass} !w-auto !py-2 min-h-[40px]`}>
            <option value="all">{t('opp.allRegions')}</option>
            {OPPORTUNITY_REGIONS.map((r) => <option key={r} value={r}>{t(`opp.region.${r}`)}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {toggle(forMe, () => setForMe((v) => !v), t('opp.forMe'))}
          {toggle(openOnly, () => setOpenOnly((v) => !v), t('opp.openOnly'))}
          {toggle(savedOnly, () => setSavedOnly((v) => !v), t('opp.savedOnly'))}
        </div>
      </GlassCard>

      <DataState isLoading={opportunities.isLoading} error={opportunities.error} onRetry={() => void opportunities.refetch()}
        empty={list.length === 0}
        emptyText={<GlassCard><p className="text-sm text-gray-700">{all.length ? t('opp.noneFound') : t('opp.none')}</p></GlassCard>}>
        <p className="text-sm text-gray-700 px-1" aria-live="polite">{tp('opp.found', list.length)}</p>
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((o) => <OpportunityCard key={o.id} o={o} />)}
          </AnimatePresence>
        </motion.div>
      </DataState>

      {adding && <OpportunityForm entry={null} onClose={() => setAdding(false)} />}
    </motion.div>
  )
}
