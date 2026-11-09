// The «Join Our Team» form's one way into the database: aitclub.org/team → here → submit_application.
//
// Guests can't call anything in the database; this function can, with the secret key, after it has
// checked Cloudflare Turnstile: the Hub's widget, with aitclub.org among its hostnames (its secret in
// TEAM_TURNSTILE_SECRET). Only tokens solved on the club site for the action `apply` pass, so a token
// from the Hub's sign-in page is no good here.
// It knows nothing about the questions: the database checks every field, keeps only what it checked,
// limits attempts and answers a repeated request with the application it already made.
//
//   GET  → {open, opens_at, closes_at}: whether the form takes applications now. No data in it.
//   POST {token, key, form} → {ok, id, created_at, department, role} or {error[, field]}.
//
// No Deno and no npm here, so scripts/apply-test.mjs runs it in Node; index.ts wires it up.

export interface RpcResult {
  data: unknown
  error: { message: string } | null
}

export interface Deps {
  /** Turnstile secret of the site's widget. Empty: every application is refused (503). */
  secret: string
  /** Pages that may call the function (CORS). */
  origins: string[]
  /** Where the widget may have been solved, as siteverify reports it. */
  hostnames: string[]
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>
  fetch: typeof fetch
  log?: (message: string) => void
}

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const ACTION = 'apply'
const MAX_BODY_BYTES = 48 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Cloudflare's published test secrets: they answer for example.com without an action. */
const TEST_SECRET = /^[123]x0{20,}/

/** The visitor's address. Cloudflare sets cf-connecting-ip itself; x-forwarded-for comes last. */
export function clientIp(headers: Headers): string | null {
  const direct = headers.get('cf-connecting-ip')?.trim() || headers.get('x-real-ip')?.trim()
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = direct || forwarded
  return ip ? ip.slice(0, 64) : null
}

interface Verdict {
  ok: boolean
  /** Cloudflare didn't answer: the visitor may try again, it isn't their fault. */
  unavailable?: boolean
  reason?: string
}

async function verify(deps: Deps, token: string, ip: string | null, key: string): Promise<Verdict> {
  // The idempotency key lets a retried request pass the check again: a token is good once otherwise,
  // and the first answer may have been lost on the way back.
  const body = new URLSearchParams({ secret: deps.secret, response: token, idempotency_key: key })
  if (ip) body.set('remoteip', ip)
  let res: Response
  try {
    res = await deps.fetch(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(10_000) })
  } catch {
    return { ok: false, unavailable: true, reason: 'siteverify unreachable' }
  }
  if (!res.ok) return { ok: false, unavailable: true, reason: `siteverify ${res.status}` }
  const out = await res.json().catch(() => null) as { success?: boolean; hostname?: string; action?: string; 'error-codes'?: string[] } | null
  if (!out?.success) return { ok: false, reason: (out?.['error-codes'] ?? []).join(',') || 'not solved' }
  if (!TEST_SECRET.test(deps.secret)) {
    if (out.action !== ACTION) return { ok: false, reason: `action ${out.action}` }
    if (deps.hostnames.length && !deps.hostnames.includes(out.hostname ?? '')) return { ok: false, reason: `hostname ${out.hostname}` }
  }
  return { ok: true }
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const origin = req.headers.get('origin') ?? ''
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': deps.origins.includes(origin) ? origin : (deps.origins[0] ?? ''),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  const log = deps.log ?? ((m: string) => console.error(m))

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  if (req.method === 'GET') {
    const { data, error } = await deps.rpc('recruitment_status', {})
    if (error) {
      log(`recruitment_status failed: ${error.message}`)
      return reply(503, { error: 'unavailable' })
    }
    return reply(200, data)
  }

  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  if (!deps.secret) return reply(503, { error: 'not_configured' })

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return reply(413, { error: 'too_large' })
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reply(413, { error: 'too_large' })

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  const { token, key, form } = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>
  if (typeof token !== 'string' || !token || token.length > 4096 || typeof key !== 'string' || !UUID.test(key)
      || !form || typeof form !== 'object' || Array.isArray(form)) {
    return reply(400, { error: 'bad_request' })
  }

  const ip = clientIp(req.headers)
  const verdict = await verify(deps, token, ip, key.toLowerCase())
  if (!verdict.ok) {
    if (verdict.unavailable) log(`turnstile: ${verdict.reason}`)
    return reply(verdict.unavailable ? 503 : 403, { error: verdict.unavailable ? 'unavailable' : 'captcha' })
  }

  const { data, error } = await deps.rpc('submit_application', { p_key: key.toLowerCase(), p_form: form, p_ip: ip })
  if (error) {
    log(`submit_application failed: ${error.message}`)
    return reply(500, { error: 'server_error' })
  }
  const result = (data ?? {}) as { ok?: boolean; error?: string; field?: string; id?: string; created_at?: string; department?: string; role?: string }
  if (result.ok) {
    return reply(200, { ok: true, id: result.id, created_at: result.created_at, department: result.department, role: result.role })
  }
  if (result.error === 'invalid_form') return reply(422, { error: 'invalid_form', field: result.field ?? 'form' })
  if (result.error === 'closed') return reply(409, { error: 'closed' })
  if (result.error === 'slow_down') return reply(429, { error: 'slow_down' })
  log(`submit_application answered ${JSON.stringify(result).slice(0, 200)}`)
  return reply(500, { error: 'server_error' })
}
