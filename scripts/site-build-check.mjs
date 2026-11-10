// Builds the club site with stand-in public values into a temporary folder and checks what came out:
// the team page with every role, the terms with the contact, a content policy that names one
// Supabase project. CI runs it on every change; the real values come with the deploy.
//
//   npm run build:site:check

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROLES } from '../src/lib/recruitment.ts'

const out = mkdtempSync(join(tmpdir(), 'ait-site-'))
const env = {
  ...process.env,
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  VITE_TEAM_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  VITE_TEAM_CONTACT: '@ait_club_team',
}

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`)
}

try {
  execFileSync('npx', ['--no-install', 'vite', 'build', '--config', 'vite.site.config.ts', '--outDir', out, '--emptyOutDir', '--logLevel', 'warn'],
    { stdio: 'inherit', env })
  const read = (file) => readFileSync(join(out, file), 'utf8')
  const team = read('team.html')
  const apply = read('apply.html')
  check('the team page lists every role, each opening the form with it', ROLES.every((r) => team.includes(`href="/apply?role=${r.id}"`)))
  const home = read('index.html')
  check('the home page has the selection with every role', home.includes('id="team"') && ROLES.every((r) => home.includes(`href="/apply?role=${r.id}"`)))
  check('the form has a page of its own', apply.includes('id="formRoot"') && !team.includes('id="formRoot"'))
  check('no placeholder is left on the pages', !/\{\{|<!-- positions -->|<!-- team-roles -->/.test(home + team + apply + read('privacy.html')))
  check('the contact is a link', team.includes('href="https://t.me/ait_club_team"') && read('privacy.html').includes('@ait_club_team'))
  check('the home page shows the selection over the page, with an end date', home.includes('id="recruitPop"') && /data-until="\d{4}-\d\d-\d\dT[\d:]+Z"/.test(home))
  const basement = home.slice(home.indexOf('id="basement"'))
  check('the basement links the club channel and lists no chats', basement.includes('href="https://t.me/ait_club_team"') && !/WhatsApp|IT-сообщество/.test(home))
  // The rules, without the comments that explain them.
  const headers = read('_headers').split('\n').filter((line) => !line.startsWith('#')).join('\n')
  check('the content policy names the project, not every Supabase host',
    headers.includes('connect-src \'self\' https://abcdefghijklmnopqrst.supabase.co;') && !headers.includes('*.supabase.co'))
  check('Turnstile may run, in its own frame', /script-src[^;]*https:\/\/challenges\.cloudflare\.com/.test(headers) && /frame-src https:\/\/challenges\.cloudflare\.com/.test(headers))
  const text = readdirSync(out, { recursive: true }).filter((f) => /\.(js|html|css)$/.test(f)).map((f) => read(f)).join('\n')
  check('no secret key in the site', !/sb_secret_|service_role/.test(text))
  const photos = [...new Set(text.match(/\/img\/news\/[\w-]+\.webp/g) ?? [])]
  check('every news photo is in the site', photos.length >= 5 && photos.every((p) => existsSync(join(out, p))))
} catch (e) {
  failed++
  console.error(e.message)
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(failed ? `\n${failed} failed` : '\nThe site builds.')
process.exitCode = failed ? 1 : 0
