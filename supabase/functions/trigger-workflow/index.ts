// trigger-workflow — the one egress point from Supabase to n8n.
//
// The browser (and the `applications` DB webhook) never hold the n8n webhook secret.
// They call this function; it authenticates the caller, then HMAC-signs the payload and
// forwards it to the matching n8n webhook. n8n verifies the signature + timestamp.
//
// Two caller types:
//   • "internal"      — server-side callers (the applications DB webhook). Proven by the
//                       shared `x-internal-key` header. Used for onboarding, where the
//                       applicant is anonymous so there is no user JWT.
//   • "authenticated" — a logged-in member triggering an in-app workflow. Proven by a
//                       Supabase JWT in `Authorization: Bearer`. (Pattern for future flows.)
//
// n8n is treated as best-effort: if it is unreachable we still return 2xx so a DB webhook
// never blocks an insert. The application row is the source of truth.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sign } from '../_shared/hmac.ts'

const N8N_WEBHOOK_BASE = Deno.env.get('N8N_WEBHOOK_BASE') ?? '' // e.g. https://n8n.example.com/webhook
const N8N_WEBHOOK_SECRET = Deno.env.get('N8N_WEBHOOK_SECRET') ?? ''
const TRIGGER_INTERNAL_KEY = Deno.env.get('TRIGGER_INTERNAL_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

type Auth = 'internal' | 'authenticated' | 'admin'

// Allowlist: only these workflow names can be triggered, each with its required auth and
// its n8n webhook path. Add a row here when you ship a new workflow.
const WORKFLOWS: Record<string, { path: string; auth: Auth }> = {
  onboarding: { path: 'onboarding', auth: 'internal' },
  'onboarding-accept': { path: 'onboarding-accept', auth: 'internal' },
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  const preflight = handleCors(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let parsed: { workflow?: string; data?: unknown }
  try {
    parsed = await req.json()
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  const wf = parsed.workflow && WORKFLOWS[parsed.workflow]
  if (!wf) return json(404, { error: 'unknown_workflow' })

  // --- authenticate the caller for this workflow ---
  if (wf.auth === 'internal') {
    const key = req.headers.get('x-internal-key') ?? ''
    if (!TRIGGER_INTERNAL_KEY || key !== TRIGGER_INTERNAL_KEY) {
      return json(401, { error: 'unauthorized' })
    }
  } else {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'unauthorized' })
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error } = await supabase.auth.getUser(token)
    if (error || !userRes?.user) return json(401, { error: 'unauthorized' })
    if (wf.auth === 'admin') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userRes.user.id)
        .single()
      if (profile?.role !== 'admin') return json(403, { error: 'forbidden' })
    }
  }

  if (!N8N_WEBHOOK_BASE || !N8N_WEBHOOK_SECRET) {
    console.error('relay misconfigured: N8N_WEBHOOK_BASE / N8N_WEBHOOK_SECRET unset')
    return json(202, { ok: false, reason: 'relay_unconfigured' })
  }

  // --- sign + forward ---
  const correlationId = crypto.randomUUID()
  const timestamp = Date.now().toString()
  const body = JSON.stringify({ correlationId, firedAt: new Date().toISOString(), data: parsed.data ?? null })
  const signature = await sign(`${timestamp}.${body}`, N8N_WEBHOOK_SECRET)

  try {
    const res = await fetch(`${N8N_WEBHOOK_BASE}/${wf.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'x-timestamp': timestamp,
        'x-correlation-id': correlationId,
      },
      body,
      signal: AbortSignal.timeout(8000),
    })
    // Don't fail the caller on a non-2xx — log for tracing, n8n's own error workflow handles it.
    if (!res.ok) console.error(`n8n ${wf.path} responded ${res.status}`, { correlationId })
    return json(202, { ok: res.ok, correlationId })
  } catch (e) {
    // n8n unreachable (home box asleep, tunnel down). The row already exists; surface, don't block.
    console.error(`n8n ${wf.path} unreachable`, { correlationId, error: String(e) })
    return json(202, { ok: false, correlationId, reason: 'n8n_unreachable' })
  }
})
