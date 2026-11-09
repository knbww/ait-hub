// The `apply` edge function without Deno and without the network: its handler with a stand-in
// database and a stand-in Turnstile.
//
//   npm run test:apply

import { clientIp, handle } from '../supabase/functions/apply/handler.ts'

let passed = 0
const failures = []
const check = (name, ok, detail = '') => (ok ? passed++ : failures.push(`${name}${detail ? ` — ${detail}` : ''}`))

const SITE = 'https://aitclub.org'
const KEY = '7d4a1c5e-2b3f-4e6a-9c8d-1f2e3a4b5c6d'
const FORM = { full_name: 'Тест' }

/** A Turnstile that answers `verdict`, and a database that answers `result`, both recording calls. */
function setup({ verdict = { success: true, action: 'apply', hostname: 'aitclub.org' }, status = 200, result = { ok: true, id: 'AIT-ABC234' },
  rpcError = null, secret = 'real-secret', unreachable = false } = {}) {
  const calls = { verify: [], rpc: [] }
  const deps = {
    secret,
    origins: [SITE, 'https://www.aitclub.org'],
    hostnames: ['aitclub.org', 'www.aitclub.org'],
    log: () => {},
    fetch: async (url, init) => {
      calls.verify.push({ url, body: Object.fromEntries(new URLSearchParams(init.body)) })
      if (unreachable) throw new Error('offline')
      return new Response(JSON.stringify(verdict), { status })
    },
    rpc: async (name, args) => {
      calls.rpc.push({ name, args })
      if (rpcError) return { data: null, error: { message: rpcError } }
      return { data: name === 'recruitment_status' ? { open: true } : result, error: null }
    },
  }
  return { deps, calls }
}

const post = (body, headers = {}) =>
  new Request('https://x.supabase.co/functions/v1/apply', {
    method: 'POST',
    headers: { origin: SITE, 'content-type': 'application/json', 'cf-connecting-ip': '5.6.7.8', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const good = () => post({ token: 'tok', key: KEY.toUpperCase(), form: FORM })

// ── CORS and methods ────────────────────────────────────────────────────────
{
  const { deps } = setup()
  const pre = await handle(new Request('https://x/apply', { method: 'OPTIONS', headers: { origin: SITE } }), deps)
  check('cors: the site gets its own origin back', pre.status === 204 && pre.headers.get('access-control-allow-origin') === SITE)
  const evil = await handle(new Request('https://x/apply', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), deps)
  check('cors: another site is not let in', evil.headers.get('access-control-allow-origin') === SITE)
  const get = await handle(new Request('https://x/apply', { method: 'GET', headers: { origin: SITE } }), deps)
  check('get: tells whether the form is open', get.status === 200 && (await get.json()).open === true)
  const put = await handle(new Request('https://x/apply', { method: 'PUT' }), deps)
  check('other methods are refused', put.status === 405)
}

// ── What a request must look like ───────────────────────────────────────────
{
  const { deps, calls } = setup({ secret: '' })
  const res = await handle(good(), deps)
  check('no secret: refuses everything', res.status === 503 && (await res.json()).error === 'not_configured' && calls.verify.length === 0)
}
{
  const { deps, calls } = setup()
  for (const [name, body] of [
    ['not JSON', '{nope'],
    ['an array', '[]'],
    ['no token', { key: KEY, form: FORM }],
    ['a key that is not a UUID', { token: 't', key: 'abc', form: FORM }],
    ['no form', { token: 't', key: KEY }],
    ['a form that is a list', { token: 't', key: KEY, form: [] }],
  ]) {
    const res = await handle(post(body), deps)
    check(`bad request: ${name}`, res.status === 400)
  }
  const big = await handle(post({ token: 't', key: KEY, form: { text: 'я'.repeat(30_000) } }), deps)
  check('bad request: more than 48 KB', big.status === 413)
  check('bad requests never reach Turnstile or the database', calls.verify.length === 0 && calls.rpc.length === 0)
}

// ── Turnstile ───────────────────────────────────────────────────────────────
{
  const { deps, calls } = setup({ verdict: { success: false, 'error-codes': ['invalid-input-response'] } })
  const res = await handle(good(), deps)
  check('captcha: an unsolved one is refused', res.status === 403 && (await res.json()).error === 'captcha')
  check('captcha: and the database is not asked', calls.rpc.length === 0)
}
for (const [name, verdict] of [
  ['another action', { success: true, action: 'login', hostname: 'aitclub.org' }],
  ['solved on another site', { success: true, action: 'apply', hostname: 'evil.example' }],
]) {
  const { deps, calls } = setup({ verdict })
  const res = await handle(good(), deps)
  check(`captcha: ${name} is refused`, res.status === 403 && calls.rpc.length === 0)
}
{
  const { deps } = setup({ unreachable: true })
  const res = await handle(good(), deps)
  check('captcha: Cloudflare unreachable is a 503, not the visitor\'s fault', res.status === 503 && (await res.json()).error === 'unavailable')
}
{
  const { deps } = setup({ status: 500 })
  const res = await handle(good(), deps)
  check('captcha: Cloudflare failing is a 503 too', res.status === 503)
}
{
  const { deps, calls } = setup({ secret: '1x0000000000000000000000000000000AA', verdict: { success: true, hostname: 'example.com', action: '' } })
  const res = await handle(good(), deps)
  check('captcha: Cloudflare\'s test secret works locally', res.status === 200 && calls.rpc.length === 1)
}

// ── Submitting ──────────────────────────────────────────────────────────────
{
  const { deps, calls } = setup()
  const res = await handle(good(), deps)
  const body = await res.json()
  check('submit: the application number comes back', res.status === 200 && body.ok === true && body.id === 'AIT-ABC234')
  const v = calls.verify[0]?.body ?? {}
  check('submit: siteverify gets the secret, the token, the address and the key',
    v.secret === 'real-secret' && v.response === 'tok' && v.remoteip === '5.6.7.8' && v.idempotency_key === KEY)
  const r = calls.rpc[0]
  check('submit: the database gets the key, the form and the address',
    r?.name === 'submit_application' && r.args.p_key === KEY && r.args.p_form.full_name === 'Тест' && r.args.p_ip === '5.6.7.8')
  check('submit: the answer is not cached', res.headers.get('cache-control') === 'no-store')
}
for (const [result, status, error] of [
  [{ error: 'invalid_form', field: 'email' }, 422, 'invalid_form'],
  [{ error: 'closed' }, 409, 'closed'],
  [{ error: 'slow_down' }, 429, 'slow_down'],
  [{ something: 'else' }, 500, 'server_error'],
]) {
  const { deps } = setup({ result })
  const res = await handle(good(), deps)
  const body = await res.json()
  check(`submit: ${error} → ${status}`, res.status === status && body.error === error && (error !== 'invalid_form' || body.field === 'email'))
}
{
  const { deps } = setup({ rpcError: 'permission denied' })
  const res = await handle(good(), deps)
  const body = await res.json()
  check('submit: a database error says nothing about itself', res.status === 500 && body.error === 'server_error' && !JSON.stringify(body).includes('permission'))
}

// ── The visitor's address ───────────────────────────────────────────────────
const h = (o) => new Headers(o)
check('ip: cf-connecting-ip comes first', clientIp(h({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' })) === '1.1.1.1')
check('ip: then the first x-forwarded-for', clientIp(h({ 'x-forwarded-for': ' 3.3.3.3, 4.4.4.4' })) === '3.3.3.3')
check('ip: none at all is null, not a shared bucket', clientIp(h({})) === null)

for (const f of failures) console.error(`  ✗ ${f}`)
console.log(`\n${passed} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
