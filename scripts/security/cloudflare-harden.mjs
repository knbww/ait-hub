// Brings the aitclub.org zone to the settings in docs/security/RUNBOOK.md, using only what the free
// plan offers. Without --apply it reads the zone and prints what it would change; run it again with
// --apply to change it, and as often as you like after that: settled things stay as they are.
//
//   read -rs CF_ZONE_TOKEN && export CF_ZONE_TOKEN
//   npm run security:cloudflare                 # the plan
//   npm run security:cloudflare -- --apply      # the changes
//
// CF_ZONE_TOKEN is a separate token for this one job (the deploy token can't see the zone); the
// runbook says which permissions it needs. Delete it afterwards. The account id comes from
// .env.local. Rules that aren't ours are left where they are.
//
// Flags: --dmarc=reject|quarantine|none (default reject), --no-turnstile.

import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const API = process.env.CF_API_BASE ?? 'https://api.cloudflare.com/client/v4'
const TOKEN = process.env.CF_ZONE_TOKEN
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const ZONE_NAME = 'aitclub.org'
const HUB_HOST = 'hub.aitclub.org'
const OURS = 'aithub:' // Rules with this prefix are managed here.

const apply = process.argv.includes('--apply')
const skipTurnstile = process.argv.includes('--no-turnstile')
const dmarcPolicy = /^--dmarc=(reject|quarantine|none)$/.exec(process.argv.find((a) => a.startsWith('--dmarc=')) ?? '')?.[1] ?? 'reject'

if (!TOKEN) {
  console.error('CF_ZONE_TOKEN is not set. See docs/security/RUNBOOK.md.')
  process.exit(1)
}

// ── What the zone should look like ──────────────────────────────────────────
const SETTINGS = {
  ssl: 'strict',
  min_tls_version: '1.2',
  tls_1_3: 'on',
  always_use_https: 'on',
  automatic_https_rewrites: 'on',
  browser_check: 'on',
  security_level: 'medium',
  // Cloudflare must not rewrite the pages: both would add scripts next to a strict content policy.
  email_obfuscation: 'off',
  rocket_loader: 'off',
  // A copy for the Internet Archive has no place on a members' portal.
  always_online: 'off',
}

// Cloudflare adds what Universal SSL needs on top of these as soon as the zone has a CAA record.
const CAA_ISSUERS = ['pki.goog; cansignhttpexchanges=yes', 'letsencrypt.org', 'ssl.com', 'sectigo.com']
const DMARC = `v=DMARC1; p=${dmarcPolicy}; sp=${dmarcPolicy}; adkim=s; aspf=s`

const path = 'lower(http.request.uri.path)'
const SCANNER_PATHS = ['/.env', '/.git/', '/.aws', '/.ssh', '/.svn', '/.ds_store', 'wp-login', 'wp-admin', 'wp-content',
  'xmlrpc.php', 'phpmyadmin', '/vendor/phpunit', '/cgi-bin/']
const SCANNER_ENDINGS = ['.php', '.asp', '.aspx', '.jsp', '.sql', '.bak', '.old']

// The free plan has five custom rules and no regular expressions.
const WAF_RULES = [
  {
    description: `${OURS} scanners looking for secrets and admin panels`,
    action: 'block',
    expression: [
      ...SCANNER_PATHS.map((p) => `(${path} contains "${p}")`),
      ...SCANNER_ENDINGS.map((p) => `ends_with(${path}, "${p}")`),
    ].join(' or '),
  },
  {
    description: `${OURS} static sites only answer GET, HEAD and OPTIONS`,
    action: 'block',
    expression: 'not (http.request.method in {"GET" "HEAD" "OPTIONS"})',
  },
]

// One rule, ten seconds, by address. A class scanning the join QR at the same time shares one
// address and asks for several files each, so the limit is high: it's here for flood scripts only.
const RATE_RULE = {
  description: `${OURS} flood from one address`,
  action: 'block',
  expression: 'not starts_with(http.request.uri.path, "/assets/")',
  ratelimit: { characteristics: ['cf.colo.id', 'ip.src'], period: 10, requests_per_period: 300, mitigation_timeout: 10 },
}

// ── API ─────────────────────────────────────────────────────────────────────
async function cf(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok && json.success !== false, result: json.result, errors: json.errors ?? [] }
}
const why = (r) => `${r.status} ${r.errors.map((e) => e.message).join('; ')}`

let changes = 0
let problems = 0
const same = (what) => console.log(`  ok      ${what}`)
const change = (what) => {
  changes++
  console.log(`  ${apply ? 'changed' : 'change '} ${what}`)
}
const problem = (what) => {
  problems++
  console.log(`  ERROR   ${what}`)
}

async function settings(zone) {
  console.log('\nZone settings')
  for (const [name, wanted] of Object.entries(SETTINGS)) {
    const now = await cf('GET', `/zones/${zone}/settings/${name}`)
    if (!now.ok) {
      problem(`${name}: ${why(now)}`)
      continue
    }
    if (now.result.value === wanted) {
      same(`${name} = ${wanted}`)
      continue
    }
    if (apply) {
      const done = await cf('PATCH', `/zones/${zone}/settings/${name}`, { value: wanted })
      if (!done.ok) {
        problem(`${name}: ${why(done)}`)
        continue
      }
    }
    change(`${name}: ${now.result.value} → ${wanted}`)
  }
}

async function dnssec(zone) {
  console.log('\nDNSSEC')
  let state = await cf('GET', `/zones/${zone}/dnssec`)
  if (!state.ok) return problem(why(state))
  if (state.result.status === 'disabled') {
    if (apply) {
      state = await cf('PATCH', `/zones/${zone}/dnssec`, { status: 'active' })
      if (!state.ok) return problem(why(state))
    }
    change('turn on DNSSEC')
  } else {
    same(`status: ${state.result.status}`)
  }
  const ds = state.result
  if (ds.digest) {
    console.log(`\n  At Namecheap: Domain List → Manage → Advanced DNS → DNSSEC → Add new DS:
    Key Tag:     ${ds.key_tag}
    Algorithm:   ${ds.algorithm}
    Digest Type: ${ds.digest_type}
    Digest:      ${ds.digest}`)
  }
}

async function dnsRecords(zone) {
  console.log('\nDNS records')
  const caa = await cf('GET', `/zones/${zone}/dns_records?type=CAA&name=${ZONE_NAME}&per_page=100`)
  if (!caa.ok) return problem(why(caa))
  for (const value of CAA_ISSUERS) {
    if (caa.result.some((r) => r.data?.tag === 'issue' && r.data?.value === value)) {
      same(`CAA issue ${value}`)
      continue
    }
    if (apply) {
      const done = await cf('POST', `/zones/${zone}/dns_records`, {
        type: 'CAA', name: ZONE_NAME, ttl: 3600, data: { flags: 0, tag: 'issue', value },
      })
      if (!done.ok) {
        problem(`CAA ${value}: ${why(done)}`)
        continue
      }
    }
    change(`add CAA issue ${value}`)
  }

  const name = `_dmarc.${ZONE_NAME}`
  const txt = await cf('GET', `/zones/${zone}/dns_records?type=TXT&name=${name}&per_page=100`)
  if (!txt.ok) return problem(why(txt))
  const current = txt.result.find((r) => /v=DMARC1/.test(r.content))
  const stripped = current?.content.replace(/^"|"$/g, '')
  if (stripped === DMARC) return same(`DMARC ${DMARC}`)
  if (apply) {
    const body = { type: 'TXT', name, ttl: 3600, content: DMARC }
    const done = current
      ? await cf('PUT', `/zones/${zone}/dns_records/${current.id}`, body)
      : await cf('POST', `/zones/${zone}/dns_records`, body)
    if (!done.ok) return problem(`DMARC: ${why(done)}`)
  }
  change(`DMARC: ${stripped ?? 'none'} → ${DMARC}`)
}

const managed = (rule) => (rule.description ?? '').startsWith(OURS)
// Compares what we set: the API fills in defaults of its own.
const essence = ({ description, expression, action, ratelimit: r }) => JSON.stringify(
  [description, expression, action, r && [r.characteristics, r.period, r.requests_per_period, r.mitigation_timeout]])
const outgoing = (rule) => {
  // Fields the API adds on its own don't go back.
  const { id, version, last_updated: lastUpdated, ...rest } = rule
  void id
  void version
  void lastUpdated
  return rest
}

async function phase(zone, name, wanted) {
  const url = `/zones/${zone}/rulesets/phases/${name}/entrypoint`
  const now = await cf('GET', url)
  if (!now.ok && now.status !== 404) return problem(`${name}: ${why(now)}`)
  const rules = now.ok ? now.result.rules ?? [] : []
  const foreign = rules.filter((r) => !managed(r))
  const ours = rules.filter(managed)
  const settled = ours.length === wanted.length && wanted.every((w) => ours.some((r) => essence(r) === essence(w)))
  if (settled) {
    for (const w of wanted) same(w.description)
    return
  }
  if (apply) {
    const done = await cf('PUT', url, { rules: [...wanted, ...foreign.map(outgoing)] })
    if (!done.ok) return problem(`${name}: ${why(done)}`)
  }
  for (const w of wanted) change(`rule: ${w.description}`)
  if (foreign.length) console.log(`          ${foreign.length} rule(s) that aren't ours stay in place`)
}

async function turnstile() {
  console.log('\nTurnstile')
  if (skipTurnstile) return console.log('  skipped')
  if (!ACCOUNT) return problem('CLOUDFLARE_ACCOUNT_ID is not in .env.local')
  const list = await cf('GET', `/accounts/${ACCOUNT}/challenges/widgets?per_page=50`)
  if (!list.ok) return problem(`${why(list)} — the token needs Account → Turnstile: Edit, or use --no-turnstile and create the widget in the dashboard`)
  const widget = list.result.find((w) => (w.domains ?? []).some((domain) => domain === HUB_HOST))
  if (widget) {
    same(`widget for ${HUB_HOST}, site key ${widget.sitekey}`)
    return
  }
  if (!apply) return change(`create a widget for ${HUB_HOST}`)
  const made = await cf('POST', `/accounts/${ACCOUNT}/challenges/widgets`, { name: 'AIT Hub', domains: [HUB_HOST], mode: 'managed' })
  if (!made.ok) return problem(why(made))
  change(`widget created for ${HUB_HOST}`)
  console.log(`
  Shown once. Don't paste the secret anywhere but the two places below:
    Site key: ${made.result.sitekey}   → VITE_TURNSTILE_SITE_KEY in .env.local (and the GitHub variable)
    Secret:   ${made.result.secret}   → Supabase → Authentication → Attack Protection`)
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log(apply ? 'Applying.' : 'Plan only: nothing changes without --apply.')
const zones = await cf('GET', `/zones?name=${ZONE_NAME}`)
if (!zones.ok || !zones.result?.length) {
  console.error(`The token can't see ${ZONE_NAME}: ${why(zones)}`)
  process.exit(1)
}
const zone = zones.result[0].id
console.log(`Zone ${ZONE_NAME}, plan ${zones.result[0].plan?.name ?? 'unknown'}`)

await settings(zone)
await dnssec(zone)
await dnsRecords(zone)
console.log('\nFirewall')
await phase(zone, 'http_request_firewall_custom', WAF_RULES)
await phase(zone, 'http_ratelimit', [RATE_RULE])
await turnstile()

const verdict = apply ? `${changes} changed` : `${changes} to change`
console.log(`\n${verdict}, ${problems} error(s).`)
if (!apply && changes) console.log('Run again with --apply when the list looks right.')
process.exitCode = problems ? 1 : 0
