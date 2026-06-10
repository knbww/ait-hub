import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/50 text-sm outline-none focus:border-gray-900 transition-colors'

export function ApplyModal({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [motivation, setMotivation] = useState('')
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
    const { error: insertError } = await supabase.from('applications').insert({
      email,
      full_name: fullName,
      payload: { motivation },
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setDone(true)
  }

  return (
    <Modal title="Apply to AIT Hub" onClose={onClose}>
      {done ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-700 mb-4">
            Application submitted — we&apos;ll be in touch. 🎉
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
            placeholder="Full name"
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
            placeholder="Why do you want to join?"
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
            {busy ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      )}
    </Modal>
  )
}
