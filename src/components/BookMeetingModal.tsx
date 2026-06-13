import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { useI18n } from '../context/i18nContext'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/50 text-sm outline-none focus:border-gray-900 transition-colors'

interface BookMeetingModalProps {
  mentor: { id?: string; name: string }
  onClose: () => void
}

export function BookMeetingModal({ mentor, onClose }: BookMeetingModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (!supabase) {
      setError(t('common.notConfigured'))
      setBusy(false)
      return
    }
    const { error: insertError } = await supabase.from('mentorship_bookings').insert({
      mentor_id: mentor.id ?? null,
      mentor_name: mentor.name,
      requester_name: name,
      requester_email: email,
      note,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setDone(true)
  }

  return (
    <Modal title={t('book.titlePrefix', { name: mentor.name })} onClose={onClose}>
      {done ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-700 mb-4">{t('book.sent', { name: mentor.name })}</p>
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
            placeholder={t('book.yourName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className={inputClass}
            type="email"
            placeholder={t('book.yourEmail')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <textarea
            className={inputClass}
            placeholder={t('book.discuss')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-normal hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
          >
            {busy ? t('book.sending') : t('book.send')}
          </button>
        </form>
      )}
    </Modal>
  )
}
