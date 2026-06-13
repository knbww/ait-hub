import { supabase } from './supabase'

// Streaming client for the AIT Copilot Edge Function. The browser never sees the Groq key — it
// calls our own `ai-chat` function with the member's Supabase JWT and reads the SSE stream back.

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StreamChunk {
  choices?: { delta?: { content?: string } }[]
}

/** POST the conversation and invoke `onToken` for each streamed delta. Throws on transport/auth
 * errors so the UI can show a graceful fallback. */
export async function streamChat(
  messages: ChatMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!supabase) throw new Error('unconfigured')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('unauthorized')

  const res = await fetch(`${FUNCTIONS_BASE}/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`ai_error_${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // keep the trailing partial line for the next chunk

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const chunk = JSON.parse(payload) as StreamChunk
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) onToken(delta)
      } catch {
        // ignore keep-alive comments / partial JSON
      }
    }
  }
}
