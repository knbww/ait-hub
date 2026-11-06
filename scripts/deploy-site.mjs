// Build and publish the public club site (site/) to its own Cloudflare Pages project, ait-club.
// The Hub stays in the ait-hub project; aitclub.org and www.aitclub.org belong to ait-club once
// they are moved there in the Cloudflare dashboard (Pages → project → Custom domains).
//
//   npm run deploy:site

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

// What goes live is what was reviewed: main, committed. `--force` is for an emergency.
const git = (cmd) => execSync(`git ${cmd}`).toString().trim()
if (!process.argv.includes('--force') && (git('status --porcelain') || git('rev-parse --abbrev-ref HEAD') !== 'main')) {
  console.error('Publishing needs a clean checkout of main. Commit or stash first, or pass --force.')
  process.exit(1)
}

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env
if (!token || !account) {
  console.error('Missing in .env.local: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (see .env.example)')
  process.exit(1)
}

const PROJECT = 'ait-club'
const run = (cmd) => execSync(cmd, { stdio: 'inherit' })

run('npx vite build --config vite.site.config.ts')

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${PROJECT}`, {
  headers: { Authorization: `Bearer ${token}` },
})
if (res.status === 404) run(`npx --no-install wrangler pages project create ${PROJECT} --production-branch=main`)
else if (!res.ok) throw new Error(`Cloudflare API: ${res.status} ${await res.text()}`)

run(`npx --no-install wrangler pages deploy dist-site --project-name=${PROJECT} --branch=main --commit-dirty=true`)
console.log(`\nClub site: https://${PROJECT}.pages.dev`)
