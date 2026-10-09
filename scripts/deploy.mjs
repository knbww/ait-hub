// Build and publish the Hub to Cloudflare Pages from this computer. Credentials come from
// .env.local (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID — see .env.example). CI does the same
// on every push to main once the GitHub secrets are set.
//
//   npm run deploy

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  .filter((name) => !process.env[name])
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(', ')} (see .env.example)`)
  process.exit(1)
}

execSync('npm run build', { stdio: 'inherit' })
execSync('npx --yes wrangler@4.40.0 pages deploy dist --project-name=ait-hub --branch=main --commit-dirty=true', {
  stdio: 'inherit',
})
