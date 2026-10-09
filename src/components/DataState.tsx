import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { useI18n } from '../context/i18nContext'
import { errorKey } from '../lib/errors'
import { btnSmall } from '../lib/ui'

interface DataStateProps {
  isLoading: boolean
  error: unknown
  onRetry?: () => void
  /** True when loaded but there is nothing to show. */
  empty?: boolean
  emptyText?: ReactNode
  children: ReactNode
}

/** Loading / error-with-retry / empty states for a query, so a failed request never looks
 * like "nothing here". */
export function DataState({ isLoading, error, onRetry, empty, emptyText, children }: DataStateProps) {
  const { t } = useI18n()
  if (isLoading) {
    return (
      <div className="space-y-2 py-1" aria-busy="true">
        <div className="h-4 rounded-lg bg-gray-900/5 animate-pulse w-2/3" />
        <div className="h-4 rounded-lg bg-gray-900/5 animate-pulse w-1/2" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-red-700" role="alert">
        <span>{t(errorKey(error))}</span>
        {onRetry && (
          <button onClick={onRetry} className={`${btnSmall} border border-red-600/40 hover:bg-red-600/10`}>
            <RefreshCw className="w-3.5 h-3.5" /> {t('common.retry')}
          </button>
        )}
      </div>
    )
  }
  if (empty) return <div className="text-sm text-gray-600">{emptyText ?? t('common.empty')}</div>
  return <>{children}</>
}

/** An error from an action, in words the member understands. */
export function ErrorText({ error }: { error: unknown }) {
  const { t } = useI18n()
  if (!error) return null
  return (
    <p className="text-sm text-red-700" role="alert">
      {t(errorKey(error))}
    </p>
  )
}
