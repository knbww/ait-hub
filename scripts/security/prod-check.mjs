// Read-only look at the club's production database, from your own computer: which migrations are
// applied, and Supabase's own security advisors. Uses SUPABASE_DB_URL from .env.local and reads the
// schema, no member data.
//
//   npm run security:prod
//
// For the numbers behind the rollout (who still has no second factor), paste
// scripts/security/prod-audit.sql into the Supabase SQL Editor.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('Missing in .env.local: SUPABASE_DB_URL')
  process.exit(1)
}

const run = (title, args) => {
  console.log(`\n── ${title} ──`)
  const { status } = spawnSync('npx', ['--no-install', 'supabase', ...args], { stdio: 'inherit' })
  return status ?? 1
}

const migrations = run('Migrations: local and remote must match', ['migration', 'list', '--db-url', url])
const advisors = run('Security advisors', ['db', 'advisors', '--db-url', url, '--type', 'security', '--level', 'info', '--fail-on', 'error'])
process.exitCode = migrations || advisors ? 1 : 0
