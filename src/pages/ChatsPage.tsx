import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Flag, FolderKanban, Loader2, MessageCircle, SendHorizontal, Shield, Trash2, Users } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { Avatar } from '../components/Avatar'
import { DataState, ErrorText } from '../components/DataState'
import { LinkifiedText } from '../components/LinkifiedText'
import { Modal } from '../components/Modal'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useInbox, useMessages } from '../hooks/useChats'
import { useTeams } from '../hooks/useTeams'
import { deleteMessage, markChatRead, openLeadChat, openTeamChat, reportMessage, sendMessage } from '../lib/chatActions'
import { formatAgo, formatDay, toDay } from '../lib/club'
import type { ConversationRow, MessageRow } from '../lib/db'
import { btnPrimary, btnSecondary, inputClass, labelClass, pageTitle } from '../lib/ui'

function KindIcon({ kind }: { kind: ConversationRow['kind'] }) {
  if (kind === 'team') return <Users className="w-5 h-5" />
  if (kind === 'project') return <FolderKanban className="w-5 h-5" />
  return <Shield className="w-5 h-5" />
}

function useChatTitle() {
  const { t } = useI18n()
  const { profile } = useAuth()
  return (c: ConversationRow) => {
    if (c.kind === 'lead') {
      return c.member_id === profile?.id
        ? { title: t('chat.lead.mine'), subtitle: t('chat.lead.mineHint') }
        : { title: c.name ?? t('chat.someone'), subtitle: t('chat.lead.staffHint') }
    }
    return { title: c.name ?? '', subtitle: t(`chat.kind.${c.kind}`) }
  }
}

function Inbox({ activeId }: { activeId: string | undefined }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const inbox = useInbox()
  const teams = useTeams()
  const titleOf = useChatTitle()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const list = inbox.data ?? []
  const myTeam = (teams.data ?? []).find((team) => team.team_members?.some((m) => m.profile_id === profile?.id))
  const isMember = profile?.role === 'member'
  const hasLead = list.some((c) => c.kind === 'lead' && c.member_id === profile?.id)
  const hasTeam = !!myTeam && list.some((c) => c.team_id === myTeam.id)

  const open = async (fn: () => Promise<{ data: string | null; error: unknown }>) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) return setError(res.error)
    if (res.data) navigate(`/chats/${res.data}`)
  }

  return (
    <GlassCard className="!p-3 sm:!p-4 flex flex-col min-h-0 h-full">
      <h1 className={`${pageTitle} px-1 mb-3`}>{t('chat.title')}</h1>
      {((isMember && !hasLead) || (myTeam && !hasTeam)) && (
        <div className="flex flex-wrap gap-2 mb-3 px-1">
          {isMember && !hasLead && (
            <button disabled={busy} onClick={() => void open(() => openLeadChat())} className={`${btnSecondary} !min-h-[38px]`}>
              <Shield className="w-4 h-4" /> {t('chat.writeLead')}
            </button>
          )}
          {myTeam && !hasTeam && (
            <button disabled={busy} onClick={() => void open(() => openTeamChat(myTeam.id))} className={`${btnSecondary} !min-h-[38px]`}>
              <Users className="w-4 h-4" /> {t('chat.teamChat', { name: myTeam.name })}
            </button>
          )}
        </div>
      )}
      <ErrorText error={error} />
      <DataState isLoading={inbox.isLoading} error={inbox.error} onRetry={() => void inbox.refetch()}
        empty={list.length === 0} emptyText={<p className="text-sm text-gray-700 px-1">{t('chat.none')}</p>}>
        <ul className="space-y-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {list.map((c) => {
            const { title, subtitle } = titleOf(c)
            const active = c.id === activeId
            return (
              <li key={c.id}>
                <Link to={`/chats/${c.id}`} aria-current={active ? 'page' : undefined}
                  className={`flex items-start gap-3 p-3 rounded-2xl transition-colors ${active ? 'bg-gray-900 text-white' : 'hover:bg-white/50'}`}>
                  <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${active ? 'bg-white/15' : 'bg-white/60'}`}>
                    <KindIcon kind={c.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm">
                        <span className="font-medium">{title}</span>
                        {c.kind !== 'lead' && (
                          <span className={active ? 'text-white/60' : 'text-gray-500'}> · {t(`chat.kindShort.${c.kind}`)}</span>
                        )}
                      </span>
                      {c.last_message_at && (
                        <span className={`text-[11px] shrink-0 ${active ? 'text-white/70' : 'text-gray-500'}`}>{formatAgo(c.last_message_at)}</span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${active ? 'text-white/75' : 'text-gray-600'}`}>
                        {c.last_body ? `${c.last_author_id === profile?.id ? t('chat.you') : c.last_author}: ${c.last_body}` : subtitle}
                      </span>
                      {c.unread > 0 && !active && (
                        <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#a3203a] text-white text-[11px] flex items-center justify-center tabular-nums">
                          {c.unread > 99 ? '99+' : c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </DataState>
    </GlassCard>
  )
}

function ReportDialog({ message, onClose }: { message: MessageRow; onClose: () => void }) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await reportMessage(message.id, reason)
    setBusy(false)
    if (res.error) return setError(res.error)
    setDone(true)
  }

  return (
    <Modal title={t('chat.report.title')} onClose={onClose}>
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-800">{t('chat.report.done')}</p>
          <button onClick={onClose} className={btnPrimary}>{t('common.close')}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <blockquote className="rounded-2xl bg-white/60 border border-white/80 p-3 text-sm text-gray-800 whitespace-pre-wrap break-words">
            {message.body}
          </blockquote>
          <div>
            <label className={labelClass} htmlFor="r-reason">{t('chat.report.reason')}</label>
            <textarea id="r-reason" className={inputClass} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </div>
          <p className="text-xs text-gray-600">{t('chat.report.hint')}</p>
          <ErrorText error={error} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btnPrimary}><Flag className="w-4 h-4" /> {t('chat.report.send')}</button>
            <button type="button" onClick={onClose} className={btnSecondary}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function Bubble({ m, mine, showAuthor, canRemove, onReport, onRemove }: {
  m: MessageRow
  mine: boolean
  showAuthor: boolean
  canRemove: boolean
  onReport: () => void
  onRemove: () => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const name = m.author?.full_name ?? t('chat.someone')
  const time = new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'} ${showAuthor ? 'mt-3' : 'mt-0.5'}`}>
      {!mine && (
        <span className="w-8 shrink-0">{showAuthor && <Avatar path={m.author?.avatar_path} name={name} size="sm" />}</span>
      )}
      <div className={`max-w-[80%] sm:max-w-[70%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {showAuthor && !mine && (
          <Link to={`/members/${m.author_id}`} className="text-xs text-gray-600 hover:underline mb-0.5 px-1">{name}</Link>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className={`text-left rounded-2xl px-3.5 py-2 shadow-sm ${mine
            ? 'bg-gray-900 text-white rounded-br-md'
            : 'bg-white/80 text-gray-900 border border-white rounded-bl-md'}`}>
          <LinkifiedText text={m.body} className="text-sm" />
          <span className={`block text-[10px] mt-0.5 text-right ${mine ? 'text-white/60' : 'text-gray-500'}`}>{time}</span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="flex gap-3 px-1 pt-1 text-xs">
                {!mine && (
                  <button type="button" onClick={onReport} className="inline-flex items-center gap-1 text-gray-600 hover:text-[#a3203a]">
                    <Flag className="w-3.5 h-3.5" /> {t('chat.report.action')}
                  </button>
                )}
                {canRemove && (
                  <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-gray-600 hover:text-red-700">
                    <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  )
}

function ChatView({ id }: { id: string }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const inbox = useInbox()
  const messages = useMessages(id)
  const titleOf = useChatTitle()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [reporting, setReporting] = useState<MessageRow | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const conversation = inbox.data?.find((c) => c.id === id)
  const list = useMemo(() => messages.data ?? [], [messages.data])
  const isLead = profile?.role === 'track_lead'

  // Keep the newest message in view and the chat marked as read while it is open.
  const lastId = list[list.length - 1]?.id
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    void markChatRead(id)
  }, [id, lastId])

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    const res = await sendMessage(id, body)
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

  const remove = async (m: MessageRow) => {
    if (!window.confirm(t('chat.deleteConfirm'))) return
    const res = await deleteMessage(id, m.id)
    setError(res.error)
  }

  const head = conversation ? titleOf(conversation) : null
  const notice = conversation?.kind === 'lead' ? t('chat.notice.lead') : t('chat.notice.group')

  return (
    <GlassCard className="!p-0 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/60">
        <Link to="/chats" className="lg:hidden p-2 -ml-2 rounded-lg text-gray-700 hover:bg-white/60" aria-label={t('common.back')}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-normal truncate">{head?.title ?? '…'}</h2>
          <p className="text-xs text-gray-600 truncate">{notice}</p>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-3">
        <DataState isLoading={messages.isLoading} error={messages.error} onRetry={() => void messages.refetch()}
          empty={list.length === 0}
          emptyText={<p className="text-sm text-gray-600 text-center py-10">{t('chat.empty')}</p>}>
          <ul>
            <AnimatePresence initial={false}>
              {list.map((m, i) => {
                const prev = list[i - 1]
                const day = toDay(new Date(m.created_at))
                const newDay = !prev || toDay(new Date(prev.created_at)) !== day
                const showAuthor = newDay || prev.author_id !== m.author_id
                  || Date.parse(m.created_at) - Date.parse(prev.created_at) > 10 * 60_000
                const mine = m.author_id === profile?.id
                return (
                  <Fragment key={m.id}>
                    {newDay && (
                      <li className="flex justify-center my-3" aria-hidden="true">
                        <span className="text-[11px] text-gray-600 bg-white/50 rounded-full px-3 py-0.5">{formatDay(day)}</span>
                      </li>
                    )}
                    <Bubble m={m} mine={mine} showAuthor={showAuthor} canRemove={mine || isLead}
                      onReport={() => setReporting(m)} onRemove={() => void remove(m)} />
                  </Fragment>
                )
              })}
            </AnimatePresence>
          </ul>
        </DataState>
      </div>

      <form onSubmit={(e) => void send(e)} className="border-t border-white/60 p-3 flex items-end gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
          rows={Math.min(5, Math.max(1, text.split('\n').length))} maxLength={2000}
          placeholder={t('chat.placeholder')} aria-label={t('chat.placeholder')} className={`${inputClass} resize-none`} />
        <button type="submit" disabled={busy || !text.trim()} aria-label={t('chat.send')} className={`${btnPrimary} !px-3 shrink-0`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
        </button>
      </form>
      {error ? <div className="px-4 pb-3"><ErrorText error={error} /></div> : null}
      {reporting && <ReportDialog message={reporting} onClose={() => setReporting(null)} />}
    </GlassCard>
  )
}

export function ChatsPage() {
  const { t } = useI18n()
  const { id } = useParams()

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100dvh-12.5rem)] lg:h-[calc(100dvh-9.5rem)] min-h-[440px]">
      <div className={`${id ? 'hidden lg:block' : ''} min-h-0`}>
        <Inbox activeId={id} />
      </div>
      {id ? (
        <ChatView key={id} id={id} />
      ) : (
        <GlassCard className="hidden lg:flex flex-col items-center justify-center text-center gap-2 text-gray-600">
          <MessageCircle className="w-10 h-10 text-gray-400" />
          <p className="text-sm max-w-xs">{t('chat.pick')}</p>
        </GlassCard>
      )}
    </motion.div>
  )
}
