import { Modal } from './Modal'
import { useAipJournal } from '../hooks/useAipJournal'
import { useMyAip } from '../hooks/useMyAip'
import { useI18n } from '../context/i18nContext'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Detailed AIP journal for one member, shown as a modal layer above the page:
 * all-time total + the full event history (action, time, confirmer, note). */
export function AipJournalModal({
  profileId,
  memberName,
  onClose,
}: {
  profileId: string
  memberName: string
  onClose: () => void
}) {
  const { t } = useI18n()
  const { data: journal = [] } = useAipJournal(profileId)
  const { data: total = 0 } = useMyAip(profileId)

  return (
    <Modal title={t('aipmodal.titlePrefix', { name: memberName })} onClose={onClose}>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-light">{total}</span>
        <span className="text-sm text-gray-600">{t('aipmodal.totalAip')}</span>
      </div>

      <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/40 -mx-1 px-1">
        {journal.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">{t('aipmodal.noEntries')}</p>
        ) : (
          journal.map((e) => (
            <div key={e.id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-normal">{t(`aip.action.${e.source}`)}</p>
                <p className="text-xs text-gray-500">
                  {formatDateTime(e.createdAt)} ·{' '}
                  {t('aippage.confirmedBy', { name: e.awarderName ?? t('aippage.auto') })}
                </p>
                {e.note && <p className="text-xs text-gray-600 italic mt-0.5">«{e.note}»</p>}
              </div>
              <span
                className={`text-sm font-medium tabular-nums shrink-0 ${
                  e.delta >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {e.delta >= 0 ? `+${e.delta}` : e.delta}
              </span>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
