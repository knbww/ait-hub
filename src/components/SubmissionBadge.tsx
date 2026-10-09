import { useI18n } from '../context/i18nContext'
import type { SubmissionStatus } from '../lib/db'
import { chip } from '../lib/ui'

const STYLE: Record<SubmissionStatus | 'none', string> = {
  none: 'bg-gray-900/5 text-gray-600',
  submitted: 'bg-sky-600/10 text-sky-800',
  accepted: 'bg-green-600/15 text-green-800',
  needs_work: 'bg-amber-500/20 text-amber-800',
}

export function SubmissionBadge({ status }: { status: SubmissionStatus | undefined }) {
  const { t } = useI18n()
  const key = status ?? 'none'
  return <span className={`${chip} ${STYLE[key]}`}>{t(`work.status.${key}`)}</span>
}
