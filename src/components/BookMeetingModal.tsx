import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/50 text-sm outline-none focus:border-gray-900 transition-colors'

interface BookMeetingModalProps {
  mentor: { id?: string; name: string }
  onClose: () => void
}

export function BookMeetingModal({ mentor, onClose }: BookMeetingModalProps) {
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
      setError('Supabase is not configured.')
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
    <Modal title={`Book 15 min with ${mentor.name}`} onClose={onClose}>
      {done ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-700 mb-4">
            Request sent to {mentor.name}. You&apos;ll get an email to confirm a time.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input
            className={inputClass}
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className={inputClass}
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <textarea
            className={inputClass}
            placeholder="What would you like to discuss?"
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
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}
    </Modal>
  )
}
