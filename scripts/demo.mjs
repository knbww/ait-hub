// The demo copy of the Hub: a separate free Supabase project (ait-hub-demo) with fictional
// members from supabase/seed.sql, published at https://demo.ait-hub.pages.dev. The real
// project and hub.aitclub.org are never touched.
//
//   npm run demo             new migrations + (first time) the demo data, build, publish
//   npm run demo -- --reset  wipe the demo database and lay the demo out again — the demo year
//                            is relative to today, so this also brings its dates up to date
//
// Needs in .env.local: DEMO_SUPABASE_REF, DEMO_SUPABASE_URL, DEMO_SUPABASE_ANON_KEY, DEMO_DB_URL,
// CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const need = ['DEMO_SUPABASE_REF', 'DEMO_SUPABASE_URL', 'DEMO_SUPABASE_ANON_KEY', 'DEMO_DB_URL',
  'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']
const missing = need.filter((name) => !process.env[name])
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(', ')}`)
  process.exit(1)
}

const { DEMO_SUPABASE_REF: ref, DEMO_DB_URL: dbUrl, VITE_SUPABASE_URL: clubUrl = '' } = process.env
// Never point the demo at the club's database.
if (!dbUrl.includes(ref) || !process.env.DEMO_SUPABASE_URL.includes(ref) || clubUrl.includes(ref)) {
  console.error('DEMO_* settings must all name the demo project, and it must not be the club project.')
  process.exit(1)
}

const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })

if (process.argv.includes('--reset')) {
  run(`npx supabase db reset --db-url "${dbUrl}" --yes`)
} else {
  run(`npx supabase db push --db-url "${dbUrl}" --include-seed --yes`)
}

const demoEnv = {
  VITE_SUPABASE_URL: process.env.DEMO_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.DEMO_SUPABASE_ANON_KEY,
  VITE_PUBLIC_ORIGIN: '',
  VITE_SENTRY_DSN: '',
  VITE_DEMO: 'true',
}
run('npx tsc -b && npx vite build --outDir dist-demo --emptyOutDir', demoEnv)
run('npx --yes wrangler@4.40.0 pages deploy dist-demo --project-name=ait-hub --branch=demo --commit-dirty=true')
console.log('\nDemo: https://demo.ait-hub.pages.dev — password for every account: demo-ait-2026')
