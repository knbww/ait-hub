import { Modal } from './Modal'
import { useI18n } from '../context/i18nContext'
import type { ApplicationRow } from '../lib/db-rows'

/** Big-number colour for the AI score (0–100). */
function scoreColor(s: number): string {
  if (s >= 70) return 'text-green-700'
  if (s >= 40) return 'text-amber-600'
  return 'text-red-600'
}

interface Props {
  application: ApplicationRow
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onClose: () => void
}

/** The applicant "profile" the Council reviews: AI score, the AI's assessment, the
 * candidate's own words, and accept / reject — opened from the Applications list. */
export function ApplicantModal({ application: a, busy, onAccept, onReject, onClose }: Props) {
  const { t, lang } = useI18n()
  const screening = a.ai_screening
  const pending = a.status === 'pending' || a.status === 'screened'
  const submitted = new Date(a.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const hasAssessment = Boolean(screening?.reasons?.length || screening?.flags?.length)

  return (
    <Modal title={a.full_name ?? a.email} onClose={onClose}>
      <div className="space-y-4">
        {/* identity */}
        <div className="flex items-center justify-between gap-2">
          <a
            href={`mailto:${a.email}`}
            className="text-sm text-gray-600 hover:text-[#750014] truncate"
          >
            {a.email}
          </a>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-900/10 capitalize shrink-0">
            {a.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 -mt-2">{t('applicant.submitted', { date: submitted })}</p>

        {/* AI score */}
        {a.ai_score != null && (
          <div className="flex items-end gap-3 p-4 rounded-2xl border border-white/50 bg-white/30">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {t('applicant.aiScore')}
              </span>
              <span className={`text-4xl font-bold leading-none ${scoreColor(a.ai_score)}`}>
                {a.ai_score}
                <span className="text-base text-gray-400 font-normal">/100</span>
              </span>
            </div>
            {screening?.recommended_role && (
              <span className="ml-auto text-xs px-2 py-1 rounded-full bg-[#750014]/10 text-[#750014]">
                {t('admin.suggested', { role: screening.recommended_role })}
              </span>
            )}
          </div>
        )}

        {/* AI assessment */}
        {hasAssessment && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{t('applicant.aiAssessment')}</p>
            <div className="space-y-1">
              {screening?.reasons?.map((r, i) => (
                <p key={`r${i}`} className="text-xs text-green-700">
                  ✓ {r}
                </p>
              ))}
              {screening?.flags?.map((f, i) => (
                <p key={`f${i}`} className="text-xs text-red-600">
                  ⚠ {f}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* the applicant's own words */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">{t('applicant.motivation')}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap p-3 rounded-2xl border border-white/50 bg-white/20">
            {a.payload?.motivation?.trim() || '—'}
          </p>
        </div>

        {/* actions */}
        {pending && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onAccept}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
            >
              {busy ? t('admin.accepting') : t('admin.accept')}
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-900 text-sm hover:bg-gray-900 hover:text-white transition-all duration-300 disabled:opacity-60"
            >
              {t('admin.reject')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
