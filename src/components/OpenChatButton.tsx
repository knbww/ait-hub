import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { ErrorText } from './DataState'
import { btnSecondary } from '../lib/ui'
import type { Result } from '../lib/mutate'

/** Opens (creating on first use) a chat and goes to it. */
export function OpenChatButton({ open, label }: { open: () => Promise<Result<string>>; label: string }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const go = async () => {
    setBusy(true)
    setError(null)
    const res = await open()
    setBusy(false)
    if (res.error) return setError(res.error)
    if (res.data) navigate(`/chats/${res.data}`)
  }

  return (
    <div>
      <button type="button" onClick={() => void go()} disabled={busy} className={btnSecondary}>
        <MessageCircle className="w-4 h-4" /> {label}
      </button>
      <ErrorText error={error} />
    </div>
  )
}
