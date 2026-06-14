import { useState } from 'react'
import type { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { useI18n } from '../context/i18nContext'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/50 text-sm outline-none focus:border-gray-900 transition-colors'

// The bot's @username (without @). When set, applicants get a "Connect Telegram"
// deep link so the bot can DM them the decision + invite. Unset → flow is unchanged.
const TELEGRAM_BOT = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined)?.replace(/^@/, '')

export function ApplyModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [motivation, setMotivation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Generated client-side so we can show the deep link without reading the row back
  // (anon applicants have no SELECT on `applications`).
  const [tgToken, setTgToken] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (!supabase) {
      setError(t('common.notConfigured'))
      setBusy(false)
      return
    }
    const token = crypto.randomUUID()
    const { error: insertError } = await supabase.from('applications').insert({
      email,
      full_name: fullName,
      payload: { motivation },
      telegram_token: token,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTgToken(token)
    setDone(true)
  }

  const tgLink = TELEGRAM_BOT && tgToken ? `https://t.me/${TELEGRAM_BOT}?start=${tgToken}` : null

  return (
    <Modal title={t('apply.title')} onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-700 mb-4">{t('apply.sent')}</p>
          {tgLink && (
            <div className="mb-4 p-4 rounded-2xl border border-white/50 bg-white/20 text-left">
              <p className="text-xs text-gray-600 mb-3">{t('apply.tgPrompt')}</p>
              <a
                href={tgLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#229ED9] text-white text-sm font-normal hover:scale-[1.02] transition-all duration-300"
              >
                <Send className="w-4 h-4" />
                {t('apply.tgConnect')}
              </a>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300"
          >
            {t('common.close')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input
            className={inputClass}
            placeholder={t('apply.fullName')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            className={inputClass}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <textarea
            className={inputClass}
            placeholder={t('apply.why')}
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            rows={3}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-normal hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
          >
            {busy ? t('apply.submitting') : t('apply.submit')}
          </button>
        </form>
      )}
    </Modal>
  )
}
