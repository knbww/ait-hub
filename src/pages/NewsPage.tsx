import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { ExternalLink, Heart, ImagePlus, Loader2, MessageCircle, Pencil, Pin, Plus, SendHorizontal, Trash2, X } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { Avatar } from '../components/Avatar'
import { DataState, ErrorText } from '../components/DataState'
import { LinkifiedText } from '../components/LinkifiedText'
import { Modal } from '../components/Modal'
import { PhotoGallery } from '../components/PhotoGallery'
import { TrackBadge } from '../components/TrackBadge'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useNews, useNewsComments, useNewsPhotoUrls, usePhotoRefusals } from '../hooks/useNews'
import { addComment, deleteComment, deleteNews, saveNews, setLike } from '../lib/newsActions'
import { shrinkPhoto } from '../lib/images'
import { TRACK_IDS, formatAgo, formatDate } from '../lib/club'
import type { ShrunkPhoto } from '../lib/images'
import type { NewsRow, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, inputClass, labelClass, pageTitle, segment } from '../lib/ui'

const MAX_PHOTOS = 6
const MAX_PHOTO_BYTES = 3 * 1024 * 1024
const REFUSALS_SHOWN = 12

interface AddedPhoto {
  key: string
  photo: ShrunkPhoto
  url: string
}

function PhotoThumb({ url, label, onRemove }: { url: string | undefined; label: string; onRemove: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="relative aspect-square rounded-xl overflow-hidden bg-gray-900/5">
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
      <button type="button" onClick={onRemove} aria-label={label}
        className="absolute top-1 right-1 p-1.5 rounded-full bg-black/55 text-white hover:bg-black/75">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}

function NewsForm({ post, onClose }: { post: NewsRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const { profile, isOversight } = useAuth()
  const leadTrack = isOversight ? null : (profile?.track_id ?? null)
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [link, setLink] = useState(post?.link_url ?? '')
  const [track, setTrack] = useState<TrackId | ''>(post ? (post.track_id ?? '') : (leadTrack ?? ''))
  const [pinned, setPinned] = useState(post?.pinned ?? false)
  const [allowComments, setAllowComments] = useState(post?.allow_comments ?? true)
  const [keep, setKeep] = useState<string[]>(post?.photos ?? [])
  const [added, setAdded] = useState<AddedPhoto[]>([])
  const [consent, setConsent] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const existingUrls = useNewsPhotoUrls(post?.photos ?? [])
  const refusals = usePhotoRefusals(added.length > 0)

  // Previews are object URLs: free them when the form closes.
  const addedRef = useRef(added)
  useEffect(() => { addedRef.current = added }, [added])
  useEffect(() => () => addedRef.current.forEach((a) => URL.revokeObjectURL(a.url)), [])

  const room = MAX_PHOTOS - keep.length - added.length

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError(files.length > room ? 'too_many_photos' : null)
    setProcessing(true)
    const next: AddedPhoto[] = []
    for (const file of files.slice(0, Math.max(0, room))) {
      try {
        const photo = await shrinkPhoto(file)
        if (photo.blob.size > MAX_PHOTO_BYTES) {
          setError('photo_too_big')
          continue
        }
        next.push({ key: `${file.name}-${file.lastModified}-${next.length}-${added.length}`, photo, url: URL.createObjectURL(photo.blob) })
      } catch (err) {
        setError(err)
      }
    }
    setAdded((list) => [...list, ...next])
    setProcessing(false)
  }

  const removeAdded = (key: string) => {
    setAdded((list) => {
      const gone = list.find((a) => a.key === key)
      if (gone) URL.revokeObjectURL(gone.url)
      return list.filter((a) => a.key !== key)
    })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (link.trim() && !/^https:\/\//i.test(link.trim())) return setError('invalid_link')
    if (added.length > 0 && !consent) return setError('photo_consent_needed')
    setBusy(true)
    setError(null)
    const res = await saveNews(post, {
      title: title.trim(),
      body: body.trim(),
      link_url: link.trim() || null,
      track_id: isOversight ? track || null : leadTrack,
      pinned,
      allow_comments: allowComments,
    }, { keep, add: added.map((a) => a.photo) })
    setBusy(false)
    if (res.error) return setError(res.error)
    onClose()
  }

  const names = refusals.data ?? []

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

        <div>
          <span className={labelClass}>{t('news.form.photos', { n: MAX_PHOTOS })}</span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {keep.map((path) => (
              <PhotoThumb key={path} url={existingUrls.data?.[path]} label={t('news.form.removePhoto')}
                onRemove={() => setKeep((list) => list.filter((p) => p !== path))} />
            ))}
            {added.map((a) => (
              <PhotoThumb key={a.key} url={a.url} label={t('news.form.removePhoto')} onRemove={() => removeAdded(a.key)} />
            ))}
            {room > 0 && (
              <label className={`aspect-square rounded-xl border-2 border-dashed border-gray-900/20 bg-white/40 hover:bg-white/70 hover:border-gray-900/40 transition-colors flex flex-col items-center justify-center gap-1 text-xs text-gray-600 cursor-pointer ${processing ? 'pointer-events-none opacity-60' : ''}`}>
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                {processing ? t('news.form.processing') : t('news.form.addPhoto')}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void pick(e)} disabled={processing} />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1">{t('news.form.photosHint')}</p>
        </div>

        <AnimatePresence initial={false}>
          {added.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="rounded-2xl border border-amber-700/25 bg-amber-50/70 p-3 space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  {t('news.form.consent')}
                </label>
                {refusals.isSuccess && (
                  <p className="text-xs text-gray-700">
                    {names.length === 0
                      ? t('news.form.everyoneAgreed')
                      : t('news.form.refused', {
                        names: names.slice(0, REFUSALS_SHOWN).join(', ')
                          + (names.length > REFUSALS_SHOWN ? ` ${t('news.form.andMore', { n: names.length - REFUSALS_SHOWN })}` : ''),
                      })}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            {t('news.form.pinned')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />
            {t('news.form.allowComments')}
          </label>
        </div>
        <ErrorText error={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={busy || processing} className={btnPrimary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {post ? t('common.save') : t('news.publish')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}

function LikeButton({ post }: { post: NewsRow }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const likes = post.likes ?? []
  const liked = !!profile && likes.some((l) => l.profile_id === profile.id)
  const names = likes.map((l) => l.profile?.full_name).filter((n): n is string => Boolean(n))
  const who = names.length === 0 ? '' : names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} ${t('news.form.andMore', { n: names.length - 3 })}`

  const toggle = () => {
    if (!profile) return
    void setLike(post, { id: profile.id, full_name: profile.full_name }, !liked)
  }

  return (
    <motion.button type="button" onClick={toggle} whileTap={{ scale: 0.85 }} aria-pressed={liked}
      aria-label={liked ? t('news.unlike') : t('news.like')} title={who ? t('news.likedBy', { names: who }) : undefined}
      className={`${btnSmall} gap-1.5 hover:bg-white/60 ${liked ? 'text-[#a3203a]' : 'text-gray-700'}`}>
      <motion.span key={liked ? 'on' : 'off'} initial={{ scale: liked ? 0.4 : 1 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 12 }} className="inline-flex">
        <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
      </motion.span>
      <span className="tabular-nums text-sm min-w-[1ch]">{likes.length || ''}</span>
    </motion.button>
  )
}

function Comments({ post, canModerate }: { post: NewsRow; canModerate: boolean }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const comments = useNewsComments(post.id, true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const list = comments.data ?? []

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    const res = await addComment(post.id, body)
    setBusy(false)
    if (res.error) return setError(res.error)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm(t('news.comments.deleteConfirm'))) return
    const res = await deleteComment(post.id, id)
    setError(res.error)
  }

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }} className="overflow-hidden">
      <div className="pt-3 mt-2 border-t border-gray-900/10 space-y-3">
        <DataState isLoading={comments.isLoading} error={comments.error} onRetry={() => void comments.refetch()}
          empty={list.length === 0}
          emptyText={<p className="text-sm text-gray-600">{post.allow_comments ? t('news.comments.none') : t('news.comments.closed')}</p>}>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {list.map((c) => {
                const name = c.author?.full_name ?? t('news.comments.someone')
                const mine = c.author_id === profile?.id
                return (
                  <motion.li key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
                    className="flex gap-2.5">
                    <Avatar path={c.author?.avatar_path} name={name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className={`rounded-2xl rounded-tl-md px-3 py-2 border ${mine ? 'bg-white/70 border-white/90' : 'bg-white/45 border-white/70'}`}>
                        <p className="text-xs mb-0.5">
                          <Link to={`/members/${c.author_id}`} className="font-medium hover:underline">{name}</Link>
                          <span className="text-gray-600"> · {formatAgo(c.created_at)}</span>
                        </p>
                        <LinkifiedText text={c.body} className="text-sm text-gray-800" />
                      </div>
                      {(mine || canModerate) && (
                        <button type="button" onClick={() => void remove(c.id)}
                          className="text-xs text-gray-600 hover:text-red-700 ml-3 mt-0.5">
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </DataState>
        {post.allow_comments ? (
          <form onSubmit={(e) => void send(e)} className="flex items-end gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
              rows={Math.min(5, Math.max(1, text.split('\n').length))} maxLength={1000}
              placeholder={t('news.comments.placeholder')} aria-label={t('news.comments.placeholder')}
              className={`${inputClass} resize-none`} />
            <button type="submit" disabled={busy || !text.trim()} aria-label={t('news.comments.send')}
              className={`${btnPrimary} !px-3 shrink-0`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
            </button>
          </form>
        ) : list.length > 0 && <p className="text-xs text-gray-600">{t('news.comments.closed')}</p>}
        <ErrorText error={error} />
      </div>
    </motion.div>
  )
}

function NewsItem({ post, canEdit, onEdit, openComments }: {
  post: NewsRow
  canEdit: boolean
  onEdit: () => void
  openComments: boolean
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [showComments, setShowComments] = useState(openComments)
  const commentCount = post.comments?.length ?? 0

  const remove = async () => {
    if (!window.confirm(t('news.deleteConfirm'))) return
    setBusy(true)
    const res = await deleteNews(post)
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
        <PhotoGallery paths={post.photos} />
        {post.link_url && (
          <a href={post.link_url} target="_blank" rel="noreferrer" className={`${btnSecondary} mt-3`}>
            <ExternalLink className="w-4 h-4" /> {t('news.openLink')}
          </a>
        )}

        <div className="flex items-center gap-1 mt-3 -mx-2">
          <LikeButton post={post} />
          {(post.allow_comments || commentCount > 0) && (
            <button type="button" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments}
              aria-label={t('news.comments.toggle')}
              className={`${btnSmall} gap-1.5 hover:bg-white/60 ${showComments ? 'text-gray-900' : 'text-gray-700'}`}>
              <MessageCircle className={`w-5 h-5 ${showComments ? 'fill-gray-900/10' : ''}`} />
              <span className="tabular-nums text-sm min-w-[1ch]">{commentCount || ''}</span>
            </button>
          )}
          <span className="flex-1" />
          {canEdit && (
            <>
              <button type="button" onClick={onEdit} aria-label={t('common.edit')} title={t('common.edit')}
                className={`${btnSmall} text-gray-700 hover:bg-white/60`}>
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => void remove()} disabled={busy} aria-label={t('common.delete')}
                title={t('common.delete')} className={`${btnSmall} text-red-700 hover:bg-red-600/10`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        <AnimatePresence initial={false}>
          {showComments && <Comments post={post} canModerate={canEdit} />}
        </AnimatePresence>
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

  const hashMatch = /^#news-([0-9a-f-]+)(-comments)?$/.exec(hash)
  const hashId = hashMatch?.[1]
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
            <NewsItem key={n.id} post={n} canEdit={canEdit(n)} onEdit={() => setEditing(n)}
              openComments={hashId === n.id && Boolean(hashMatch?.[2])} />
          ))}
        </div>
      </DataState>

      {editing && <NewsForm post={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </motion.div>
  )
}
