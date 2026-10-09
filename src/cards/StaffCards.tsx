import { Link } from 'react-router-dom'
import { ListChecks, QrCode } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { JoinCodePanel } from '../components/JoinCodePanel'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useJoinCodes } from '../hooks/useManage'
import { useReviewQueue } from '../hooks/useProgram'
import { btnSecondary } from '../lib/ui'

/** The QR a lead shows at the meeting so newcomers can join in one step. */
export function JoinCodeCard() {
  const { t } = useI18n()
  const { isStaff } = useAuth()
  const codes = useJoinCodes(isStaff)
  const list = [...(codes.data ?? [])].sort((a, b) => a.track_id.localeCompare(b.track_id))

  return (
    <CardShell icon={QrCode} title={t('card.joinCode')} to="/manage?tab=codes" linkLabel={t('card.manage')}>
      <DataState isLoading={codes.isLoading} error={codes.error} onRetry={() => void codes.refetch()}
        empty={list.length === 0} emptyText={t('codes.none')}>
        <div className="space-y-5">
          {list.slice(0, 1).map((code) => (
            <JoinCodePanel key={code.code} code={code} allowRotate={false} />
          ))}
          {list.length > 1 && <p className="text-xs text-gray-600">{t('codes.more', { n: list.length - 1 })}</p>}
        </div>
      </DataState>
    </CardShell>
  )
}

export function ReviewCard() {
  const { t, tp } = useI18n()
  const { isStaff } = useAuth()
  const queue = useReviewQueue(isStaff)

  return (
    <CardShell icon={ListChecks} title={t('card.review')}>
      <DataState isLoading={queue.isLoading} error={queue.error} onRetry={() => void queue.refetch()}>
        <p className="text-4xl font-light leading-none mb-1">{queue.data ?? 0}</p>
        <p className="text-sm text-gray-700 mb-4">{tp('review.waiting', queue.data ?? 0)}</p>
        <Link to="/program" className={btnSecondary}>{t('review.open')}</Link>
      </DataState>
    </CardShell>
  )
}
