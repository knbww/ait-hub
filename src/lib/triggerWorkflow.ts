import { supabase } from './supabase'

// Client → Edge Function trigger for *authenticated* in-app workflows (the React-side webhook
// pattern). The browser never holds the n8n secret: it calls our own `trigger-workflow` Edge
// Function with the user's Supabase session JWT; the Edge Function verifies it, HMAC-signs the
// payload, and forwards to n8n.
//
// NOTE: onboarding does NOT use this — applicants are anonymous, so that flow is fired
// server-side by the `applications` INSERT trigger (see the application_screening_webhook
// migration). Use this helper for workflows triggered by a logged-in member.

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1`

export async function triggerWorkflow(
  workflow: string,
  data: unknown,
): Promise<{ ok: boolean; correlationId?: string }> {
  if (!supabase) return { ok: false }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { ok: false }

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/trigger-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workflow, data }),
    })
    if (!res.ok) return { ok: false }
    return (await res.json()) as { ok: boolean; correlationId?: string }
  } catch {
    // Best-effort: automation must never break the UI action that triggered it.
    return { ok: false }
  }
}
