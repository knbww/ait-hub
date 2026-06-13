import { Activity, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { useI18n } from '../context/i18nContext'
import { useAutomationErrors } from '../hooks/useAutomationErrors'
import type { ApplicationRow } from '../lib/db-rows'

// Live view of the n8n + AI onboarding pipeline: the funnel, what the AI decided, and any failures.

const PIPELINE: { status: string; key: string }[] = [
  { status: 'pending', key: 'admin.stPending' },
  { status: 'screened', key: 'admin.stScreened' },
  { status: 'accepted', key: 'admin.stAccepted' },
  { status: 'provisioned', key: 'admin.stProvisioned' },
]

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-green-600/15 text-green-700'
  if (score >= 40) return 'bg-amber-500/20 text-amber-700'
  return 'bg-red-600/15 text-red-700'
}

export function AutomationsPanel({ applications }: { applications: ApplicationRow[] }) {
  const { t } = useI18n()
  const { data: errors = [] } = useAutomationErrors()

  const counts = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  const screened = applications.filter((a) => a.ai_score != null)

  return (
    <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-6 h-6 text-[#750014]" />
        <h2 className="text-2xl font-light">{t('admin.autoTitle')}</h2>
      </div>
      <p className="text-sm text-gray-600 mb-5">{t('admin.autoSubtitle')}</p>

      {/* Pipeline funnel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {PIPELINE.map((p) => (
          <div key={p.status} className="rounded-2xl border border-white/60 bg-white/30 px-3 py-3 text-center">
            <div className="text-2xl font-light">{counts[p.status] ?? 0}</div>
            <div className="text-xs text-gray-500">{t(p.key)}</div>
          </div>
        ))}
      </div>

      {/* AI screening verdicts */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-[#750014]" />
        <h3 className="text-sm font-medium">{t('admin.aiScreening')}</h3>
      </div>
      {screened.length === 0 ? (
        <p className="text-xs text-gray-500 mb-6">{t('admin.noScreening')}</p>
      ) : (
        <div className="space-y-1 mb-6">
          {screened.map((a) => {
            const reasons = a.ai_screening?.reasons?.slice(0, 2).join(' · ')
            return (
              <div key={a.id} className="py-2 px-3 rounded-xl hover:bg-white/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-normal truncate">{a.full_name ?? a.email}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.ai_screening?.recommended_role && (
                      <span className="text-xs text-gray-500">{a.ai_screening.recommended_role}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(a.ai_score ?? 0)}`}>
                      {a.ai_score}
                    </span>
                  </div>
                </div>
                {reasons && <p className="text-xs text-gray-500 mt-0.5">{reasons}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* n8n dead-letter feed */}
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-[#750014]" />
        <h3 className="text-sm font-medium">{t('admin.recentFailures')}</h3>
      </div>
      {errors.length === 0 ? (
        <p className="text-xs text-green-700 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> {t('admin.noFailures')}
        </p>
      ) : (
        <div className="space-y-1">
          {errors.map((e) => (
            <div key={e.id} className="py-2 px-3 rounded-xl bg-red-600/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-red-700">
                  {e.workflow ?? '—'}
                  {e.last_node ? ` · ${e.last_node}` : ''}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              {e.message && <p className="text-xs text-gray-600 mt-0.5 break-words">{e.message}</p>}
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}
