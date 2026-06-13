import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { History, Trophy } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { cardVariants, pageVariants } from '../lib/animations'
import { useAipLeaderboard } from '../hooks/useAipLeaderboard'
import type { AipScope } from '../hooks/useAipLeaderboard'
import { useAipJournal } from '../hooks/useAipJournal'
import { AipJournalModal } from '../components/AipJournalModal'
import { useI18n } from '../context/i18nContext'

const SCOPES: { id: AipScope; key: string }[] = [
  { id: 'all', key: 'aippage.scopeAll' },
  { id: 'season', key: 'aippage.scopeSeason' },
  { id: 'week', key: 'aippage.scopeWeek' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function AipPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const memberFilter = params.get('member')
  const [scope, setScope] = useState<AipScope>('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const { data: board = [] } = useAipLeaderboard(scope)
  const { data: journal = [] } = useAipJournal(memberFilter ?? undefined)

  const selectMember = (id?: string) => {
    if (!id) setDetailOpen(false)
    const next = new URLSearchParams(params)
    if (id) next.set('member', id)
    else next.delete('member')
    setParams(next, { replace: true })
  }

  const selectedName = memberFilter
    ? (board.find((b) => b.profileId === memberFilter)?.name ?? journal[0]?.memberName ?? null)
    : null

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-3xl mx-auto space-y-6"
    >
      <motion.div variants={cardVariants}>
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-7 h-7" />
            <h2 className="text-3xl font-light">{t('aippage.leaderboard')}</h2>
          </div>

          <div className="flex gap-2 mb-4">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all duration-300 ${
                  scope === s.id
                    ? 'bg-gray-900 text-white'
                    : 'border border-white/60 bg-white/30 hover:bg-white/60'
                }`}
              >
                {t(s.key)}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            {board.map((user, index) => {
              const selected = user.profileId === memberFilter
              return (
                <button
                  key={user.profileId ?? index}
                  onClick={() => selectMember(selected ? undefined : user.profileId)}
                  className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-left transition-all duration-300 ${
                    selected ? 'bg-[#750014]/10' : 'hover:bg-white/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-sm text-gray-500 tabular-nums">{index + 1}</span>
                    <span className="font-normal">{user.name}</span>
                  </div>
                  <span className="font-medium">{user.aip} AIP</span>
                </button>
              )
            })}
            {board.length === 0 && <p className="text-sm text-gray-500 py-4">{t('common.empty')}</p>}
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={cardVariants}>
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6" />
              <h2 className="text-2xl font-light">{t('aippage.journal')}</h2>
            </div>
            {selectedName && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDetailOpen(true)}
                  className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {t('aippage.more')}
                </button>
                <button
                  onClick={() => selectMember(undefined)}
                  className="text-xs px-3 py-1 rounded-full bg-[#750014]/10 text-[#750014] hover:bg-[#750014]/20 transition-colors"
                >
                  {selectedName} ✕
                </button>
              </div>
            )}
          </div>

          {journal.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('aippage.noEntries')}</p>
          ) : (
            <div className="divide-y divide-white/40">
              {journal.map((e) => (
                <div key={e.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">
                      <span className="font-normal">{e.memberName}</span>{' '}
                      <span className="text-gray-600">· {t(`aip.action.${e.source}`)}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(e.createdAt)} ·{' '}
                      {t('aippage.confirmedBy', { name: e.awarderName ?? t('aippage.auto') })}
                      {e.note ? ` · «${e.note}»` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium tabular-nums shrink-0 ${
                      e.delta >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {e.delta >= 0 ? `+${e.delta}` : e.delta} AIP
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {detailOpen && memberFilter && (
        <AipJournalModal
          profileId={memberFilter}
          memberName={selectedName ?? t('roles.member')}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </motion.div>
  )
}
