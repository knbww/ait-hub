import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { ExternalLink, Pin, Plus } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { LinkifiedText } from '../components/LinkifiedText'
import { Modal } from '../components/Modal'
import { TrackBadge } from '../components/TrackBadge'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useNews } from '../hooks/useNews'
import { deleteNews, saveNews } from '../lib/newsActions'
import { TRACK_IDS, formatDate } from '../lib/club'
import type { NewsRow, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, inputClass, labelClass, pageTitle, segment } from '../lib/ui'

function NewsForm({ post, onClose }: { post: NewsRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const { profile, isOversight } = useAuth()
  const leadTrack = isOversight ? null : (profile?.track_id ?? null)
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [link, setLink] = useState(post?.link_url ?? '')
  const [track, setTrack] = useState<TrackId | ''>(post ? (post.track_id ?? '') : (leadTrack ?? ''))
  const [pinned, setPinned] = useState(post?.pinned ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (link.trim() && !/^https:\/\//i.test(link.trim())) return setError('invalid_link')
    setBusy(true)
    setError(null)
    const res = await saveNews(post?.id ?? null, {
      title: title.trim(),
      body: body.trim(),
      link_url: link.trim() || null,
      track_id: isOversight ? track || null : leadTrack,
      pinned,
    })
    setBusy(false)
    if (res.error) return setError(res.error)
    onClose()
  }

  return (
    <Modal title={post ? t('news.edit') : t('news.add')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="n-title">{t('news.form.title')}</label>
          <input id="n-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)}
            maxLength={160} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="n-body">{t('news.form.body')}</label>
          <textarea id="n-body" className={inputClass} rows={6} value={body} onChange={(e) => setBody(e.target.value)}
            maxLength={4000} required />
          <p className="text-xs text-gray-600 mt-1">{t('news.form.bodyHint')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="n-link">{t('news.form.link')}</label>
            <input id="n-link" type="url" className={inputClass} value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="https://" maxLength={500} />
          </div>
          <div>
            <label className={labelClass} htmlFor="n-track">{t('news.form.track')}</label>
            <select id="n-track" className={inputClass} value={isOversight ? track : (leadTrack ?? '')}
              disabled={!isOversight} onChange={(e) => setTrack(e.target.value as TrackId | '')}>
              {isOversight && <option value="">{t('news.form.wholeClub')}</option>}
              {TRACK_IDS.map((id) => <option key={id} value={id}>{t(`track.${id}`)}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          {t('news.form.pinned')}
        </label>
        <ErrorText error={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>{post ? t('common.save') : t('news.publish')}</button>
          <button type="button" onClick={onClose} className={btnSecondary}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}

function NewsItem({ post, canEdit, onEdit }: { post: NewsRow; canEdit: boolean; onEdit: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const remove = async () => {
    if (!window.confirm(t('news.deleteConfirm'))) return
    setBusy(true)
    const res = await deleteNews(post.id)
    setBusy(false)
    setError(res.error)
  }

  return (
    <GlassCard className={post.pinned ? '!border-[#750014]/30' : ''}>
      <article id={`news-${post.id}`} className="scroll-mt-24">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 text-xs text-[#750014]">
              <Pin className="w-3.5 h-3.5" /> {t('news.pinned')}
            </span>
          )}
          <span className="text-xs text-gray-600">{formatDate(post.published_at)}</span>
          <TrackBadge track={post.track_id} />
          <span className="text-xs text-gray-600">· {post.author?.full_name ?? t('news.fromClub')}</span>
        </div>
        <h2 className="text-lg sm:text-xl font-normal mb-2">{post.title}</h2>
        <LinkifiedText text={post.body} className="text-sm text-gray-800" />
        {(post.link_url || canEdit) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.link_url && (
              <a href={post.link_url} target="_blank" rel="noreferrer" className={btnSecondary}>
                <ExternalLink className="w-4 h-4" /> {t('news.openLink')}
              </a>
            )}
            {canEdit && (
              <>
                <button onClick={onEdit} className={`${btnSmall} border border-gray-900/30 bg-white/40`}>{t('common.edit')}</button>
                <button onClick={remove} disabled={busy} className={`${btnSmall} border border-red-600/50 text-red-700`}>
                  {t('common.delete')}
                </button>
              </>
            )}
          </div>
        )}
        <ErrorText error={error} />
      </article>
    </GlassCard>
  )
}

export function NewsPage() {
  const { t } = useI18n()
  const { profile, isStaff, isOversight } = useAuth()
  const { hash } = useLocation()
  const news = useNews()
  const [filter, setFilter] = useState<'all' | TrackId>('all')
  const [editing, setEditing] = useState<NewsRow | null | 'new'>(null)

  const canEdit = (n: NewsRow) => isOversight || (isStaff && !!n.track_id && n.track_id === profile?.track_id)
  const list = (news.data ?? []).filter((n) => filter === 'all' || n.track_id === filter || n.track_id === null)

  const hashId = /^#news-([0-9a-f-]+)$/.exec(hash)?.[1]
  useEffect(() => {
    if (!hashId || !news.data) return
    document.getElementById(`news-${hashId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hashId, news.data])

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h1 className={pageTitle}>{t('news.title')}</h1>
          {isStaff && (
            <button onClick={() => setEditing('new')} className={btnPrimary}>
              <Plus className="w-4 h-4" /> {t('news.add')}
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button className={segment(filter === 'all')} onClick={() => setFilter('all')}>{t('track.all')}</button>
          {TRACK_IDS.map((id) => (
            <button key={id} className={segment(filter === id)} onClick={() => setFilter(id)}>{t(`track.${id}.short`)}</button>
          ))}
        </div>
      </GlassCard>

      <DataState isLoading={news.isLoading} error={news.error} onRetry={() => void news.refetch()}
        empty={list.length === 0} emptyText={<GlassCard><p className="text-sm text-gray-700">{t('news.none')}</p></GlassCard>}>
        <div className="space-y-4">
          {list.map((n) => (
            <NewsItem key={n.id} post={n} canEdit={canEdit(n)} onEdit={() => setEditing(n)} />
          ))}
        </div>
      </DataState>

      {editing && <NewsForm post={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </motion.div>
  )
}
