// Checks the live sites from the outside, the way a visitor (or an attacker) sees them: headers,
// TLS, DNS, the public API. Runs daily in .github/workflows/security-monitor.yml, and any time with
//
//   npm run security:live
//
// Only reads, with no credentials: the publishable key comes from the public bundle. Once a run it
// tries a sign-in on an address that doesn't exist, to see whether the captcha is enforced.

import { connect } from 'node:tls'

const HUB = 'https://hub.aitclub.org'
const SITE = 'https://aitclub.org'
const DOMAIN = 'aitclub.org'
const CERT_MIN_DAYS = 14
const SECURITY_TXT_MIN_DAYS = 30
const TIMEOUT_MS = 15_000

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${!ok && detail ? ` — ${detail}` : ''}`)
}
const section = (title) => console.log(`\n${title}`)

const get = (url, init = {}) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...init })

async function dns(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
  const res = await get(url, { headers: { accept: 'application/dns-json' } })
  const body = await res.json()
  return (body.Answer ?? []).map((a) => a.data)
}

function tlsConnects(host, options) {
  return new Promise((resolve) => {
    const socket = connect({ host, port: 443, servername: host, timeout: 8000, ...options }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      resolve({ ok: true, cert })
    })
    socket.on('error', () => resolve({ ok: false }))
    socket.on('timeout', () => {
      socket.destroy()
      resolve({ ok: false })
    })
  })
}

async function headers(name, origin, extra) {
  section(name)
  const res = await get(`${origin}/`)
  const h = res.headers
  const csp = h.get('content-security-policy') ?? ''
  const hsts = /max-age=(\d+)/.exec(h.get('strict-transport-security') ?? '')
  check('answers 200', res.status === 200, String(res.status))
  check('HSTS for at least a year, with subdomains and preload',
    Number(hsts?.[1] ?? 0) >= 31_536_000 && /includesubdomains/i.test(h.get('strict-transport-security') ?? '')
    && /preload/i.test(h.get('strict-transport-security') ?? ''), h.get('strict-transport-security') ?? 'missing')
  check('content policy closes everything by default', /default-src 'none'/.test(csp), csp.slice(0, 80) || 'missing')
  check('no framing', /frame-ancestors 'none'/.test(csp) && h.get('x-frame-options') === 'DENY')
  check('no base tag tricks', /base-uri 'none'/.test(csp))
  check('no eval or inline scripts', !/script-src[^;]*'unsafe-(eval|inline)'/.test(csp))
  check('nosniff', h.get('x-content-type-options') === 'nosniff')
  check('cross-origin isolation of the window', h.get('cross-origin-opener-policy') === 'same-origin')
  check('resources stay on their origin', h.get('cross-origin-resource-policy') === 'same-origin')
  check('no open CORS on pages', !h.get('access-control-allow-origin'), h.get('access-control-allow-origin') ?? '')
  check('referrer policy', Boolean(h.get('referrer-policy')))
  check('permissions policy', /camera=\(\)/.test(h.get('permissions-policy') ?? ''))
  await extra?.(res, csp)

  const http = await get(origin.replace('https:', 'http:') + '/')
  check('plain http redirects to https', [301, 308].includes(http.status) && (http.headers.get('location') ?? '').startsWith('https://'),
    `${http.status} ${http.headers.get('location')}`)

  const txt = await get(`${origin}/.well-known/security.txt`)
  const body = await txt.text()
  const expires = Date.parse(/^Expires:\s*(.+)$/m.exec(body)?.[1] ?? '')
  check('security.txt is published', txt.status === 200 && /^text\/plain/.test(txt.headers.get('content-type') ?? ''), `${txt.status}`)
  check(`security.txt is valid for ${SECURITY_TXT_MIN_DAYS} days more`, expires - Date.now() > SECURITY_TXT_MIN_DAYS * 86_400_000)
}

async function tls(host) {
  section(`TLS ${host}`)
  const modern = await tlsConnects(host, { minVersion: 'TLSv1.2' })
  check('TLS 1.2+ works', modern.ok)
  const days = (Date.parse(modern.cert?.valid_to ?? '') - Date.now()) / 86_400_000
  check(`certificate is valid for ${CERT_MIN_DAYS} days more`, days > CERT_MIN_DAYS, `${Math.floor(days)} days`)
  const old = await tlsConnects(host, { minVersion: 'TLSv1', maxVersion: 'TLSv1.1', ciphers: 'DEFAULT@SECLEVEL=0' })
  check('TLS 1.0 and 1.1 are refused', !old.ok)
}

async function dnsRecords() {
  section(`DNS ${DOMAIN}`)
  const ds = await dns(DOMAIN, 'DS')
  check('DNSSEC is on (DS record at the registrar)', ds.length > 0)
  const caa = await dns(DOMAIN, 'CAA')
  check('CAA names who may issue certificates', caa.length > 0)
  const dmarc = (await dns(`_dmarc.${DOMAIN}`, 'TXT')).join(' ')
  check('DMARC rejects forged mail', /p=reject/.test(dmarc), dmarc || 'missing')
  const spf = (await dns(DOMAIN, 'TXT')).filter((t) => t.includes('v=spf1'))
  check('one SPF record', spf.length === 1, `${spf.length} records`)
}

/** Every script the Hub can load: the entry point and the chunks it names, however deep. */
async function allChunks() {
  const seen = new Set()
  let queue = [...(await (await get(`${HUB}/`)).text()).matchAll(/assets\/[\w.-]+\.js/g)].map((m) => m[0])
  let text = ''
  while (queue.length && seen.size < 200) {
    const next = []
    for (const path of new Set(queue)) {
      if (seen.has(path)) continue
      seen.add(path)
      const body = await (await get(`${HUB}/${path}`)).text()
      text += body
      next.push(...[...body.matchAll(/assets\/[\w.-]+\.js/g)].map((m) => m[0]))
    }
    queue = next
  }
  return text
}

async function publicApi() {
  section('Public API')
  const bundle = await allChunks()
  check('the bundle holds no secret key', !/sb_secret_|service_role|cfut_/.test(bundle))
  check('the bundle is not the demo', !bundle.includes('demo-ait-2026'))
  check('the bundle has the Turnstile key', /0x4[A-Za-z0-9_-]{15,}/.test(bundle))
  const api = /https:\/\/[a-z0-9]{20}\.supabase\.co/.exec(bundle)?.[0]
  const key = /sb_publishable_[\w-]+/.exec(bundle)?.[0]
  if (!api || !key) return check('project address and key found in the bundle', false)
  const headers = { apikey: key }

  const open = []
  for (const table of ['profiles', 'member_private', 'audit_log', 'join_codes', 'staff_invites', 'password_reset_codes',
    'messages', 'conversations', 'message_reports', 'submissions', 'attendance', 'points_entries', 'push_subscriptions',
    'news', 'events', 'teams', 'projects', 'opportunities', 'tracks']) {
    const res = await get(`${api}/rest/v1/${table}?select=*&limit=1`, { headers })
    if (res.ok && (await res.text()) !== '[]') open.push(table)
  }
  check('no table answers a guest', open.length === 0, open.join(', '))

  const schema = await get(`${api}/rest/v1/`, { headers })
  check('the schema is not published', schema.status === 401 || schema.status === 403, String(schema.status))

  const buckets = await get(`${api}/storage/v1/bucket`, { headers })
  check('buckets are not listed to a guest', (await buckets.text()).trim() === '[]')
  for (const bucket of ['avatars', 'news', 'works']) {
    const res = await get(`${api}/storage/v1/object/public/${bucket}/x.png`)
    check(`bucket ${bucket} is private`, res.status === 400 || res.status === 404, String(res.status))
  }

  const auth = await get(`${api}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.invalid', password: 'not-a-real-password' }),
  })
  const authBody = await auth.text()
  check('sign-in requires a captcha', /captcha/i.test(authBody), authBody.slice(0, 100))

  const settings = await (await get(`${api}/auth/v1/settings`, { headers })).json()
  const providers = Object.entries(settings.external ?? {}).filter(([, on]) => on).map(([name]) => name).sort().join()
  check('only the expected sign-in methods', ['email', 'email,github'].includes(providers), providers)

  const push = await get(`${api}/functions/v1/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  check('the push function wants a session', push.status === 401, String(push.status))
  const cors = await get(`${api}/functions/v1/push`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
  check('the push function answers only the Hub', cors.headers.get('access-control-allow-origin') === HUB, cors.headers.get('access-control-allow-origin') ?? '')
}

const steps = [
  () => headers(HUB, HUB, async (res, csp) => {
    check('not for search engines', /noindex/.test(res.headers.get('x-robots-tag') ?? ''))
    check('Trusted Types are on', /require-trusted-types-for 'script'/.test(csp))
    const missing = await get(`${HUB}/assets/does-not-exist.js`)
    check('a missing build file is a 404, not the app', missing.status === 404, String(missing.status))
  }),
  () => headers(SITE, SITE),
  () => tls('hub.aitclub.org'),
  () => tls(DOMAIN),
  dnsRecords,
  publicApi,
]

for (const step of steps) {
  try {
    await step()
  } catch (e) {
    check('the check itself finished', false, e.message)
  }
}

console.log(failed ? `\n${failed} failed` : '\nAll good')
process.exitCode = failed ? 1 : 0
