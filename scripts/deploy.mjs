// Build and publish the Hub to Cloudflare Pages from this computer. Credentials come from
// .env.local (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID — see .env.example). CI does the same
// on every push to main once the GitHub secrets are set.
//
//   npm run deploy

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

// What goes live is what was reviewed: main, committed. `--force` is for an emergency.
const git = (cmd) => execSync(`git ${cmd}`).toString().trim()
if (!process.argv.includes('--force') && (git('status --porcelain') || git('rev-parse --abbrev-ref HEAD') !== 'main')) {
  console.error('Publishing needs a clean checkout of main. Commit or stash first, or pass --force.')
  process.exit(1)
}

// Supabase requires the captcha on sign-in: a build without the Turnstile key locks everyone out.
const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_TURNSTILE_SITE_KEY']
  .filter((name) => !process.env[name])
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(', ')} (see .env.example)`)
  process.exit(1)
}

execSync('npm run build', { stdio: 'inherit' })
execSync('npx --no-install wrangler pages deploy dist --project-name=ait-hub --branch=main --commit-dirty=true', {
  stdio: 'inherit',
})
