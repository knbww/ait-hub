import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { DEPARTMENTS, DIRECTIONS, contactHref } from './src/lib/recruitment'

// The public club site (aitclub.org): static pages built separately from the Hub.
//   npx vite build --config vite.site.config.ts  →  dist-site/
// The basement shows which build is live: the short commit and the day it was built.
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()
const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' })
  .format(new Date())
  .replace(/\s*г\.$/, '')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const roles = (n: number) => (n === 1 ? 'роль' : n < 5 ? 'роли' : 'ролей')

/** Open Positions on aitclub.org/team, from the same list the form and the database use. */
function positions(): string {
  return DEPARTMENTS.map((d) => `
            <article class="reveal dept-card glass" id="dept-${d.id}">
              <canvas class="dept-cover" data-figure="${d.id}" aria-hidden="true"></canvas>
              <div class="dept-body">
                <div class="dept-head"><h3>${esc(d.title)}</h3><span class="dept-count mono">${d.roles.length} ${roles(d.roles.length)}</span></div>
                <p>${esc(d.summary)}</p>${d.id === 'education' ? `
                <ul class="dept-dirs" aria-label="Направления">${DIRECTIONS.map((x) => `<li>${esc(x.label)}</li>`).join('')}</ul>` : ''}
                <ul class="role-list">${d.roles.map((r) => `
                  <li><a class="role-pick" href="#apply" data-dept="${d.id}" data-role="${r.id}"><b>${esc(r.title)}</b><span>${esc(r.duty)}</span><i aria-hidden="true">Подать →</i></a></li>`).join('')}
                </ul>
              </div>
            </article>`).join('')
}

// What the team form needs to work. Public values (they end up in the page), but a build without
// them would publish a form that can't send anything: it is refused. The Turnstile key is the Hub's
// (VITE_TURNSTILE_SITE_KEY) unless the site has a widget of its own.
const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_TEAM_CONTACT']

function clubSite(mode: string): Plugin {
  let env: Record<string, string> = {}
  let outDir = 'dist-site'
  let building = false
  return {
    name: 'club-site',
    configResolved(config) {
      env = loadEnv(mode, config.envDir || config.root, 'VITE_')
      outDir = resolve(config.root, config.build.outDir)
      building = config.command === 'build'
      if (!building) return
      const missing = REQUIRED.filter((k) => !env[k]?.trim())
      if (!env.VITE_TEAM_TURNSTILE_SITE_KEY?.trim() && !env.VITE_TURNSTILE_SITE_KEY?.trim()) missing.push('VITE_TURNSTILE_SITE_KEY')
      if (missing.length) {
        throw new Error(`The club site needs ${missing.join(', ')} in .env.local or the environment: the team form can't work without them (docs/security/RUNBOOK.md).`)
      }
      if (!contactHref(env.VITE_TEAM_CONTACT)) throw new Error('VITE_TEAM_CONTACT must be a Telegram @handle, an email or an https:// address.')
      // https, or a local stack (npx supabase start) for a test of the built site.
      if (!/^(https:\/\/[^/]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)\/?$/.test(env.VITE_SUPABASE_URL.trim())) {
        throw new Error('VITE_SUPABASE_URL must be the https:// address of the Supabase project.')
      }
    },
    transformIndexHtml(html) {
      const contact = env.VITE_TEAM_CONTACT?.trim() ?? ''
      return html
        .replace('<!-- positions -->', positions())
        .replaceAll('{{contact_href}}', esc(contactHref(contact) ?? '#faq'))
        .replaceAll('{{contact}}', esc(contact || 'контакт не указан (VITE_TEAM_CONTACT)'))
    },
    // The content policy names exactly this build's Supabase project, as the Hub's does.
    closeBundle() {
      const file = `${outDir}/_headers`
      if (!building || !existsSync(file)) return
      const origin = new URL(env.VITE_SUPABASE_URL.trim()).origin
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('https://*.supabase.co', origin))
    },
  }
}

export default defineConfig(({ mode }) => ({
  root: 'site',
  // .env.local lives at the top of the repository, next to the Hub's.
  envDir: '..',
  plugins: [clubSite(mode)],
  define: { __BUILD__: JSON.stringify(`${commit}, ${day}`) },
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
    // Fonts stay files: the content policy has no data: in font-src.
    assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? false : undefined),
    rollupOptions: {
      // 404.html: Cloudflare Pages serves it for unknown paths (with a 404 status).
      input: { main: 'site/index.html', team: 'site/team.html', privacy: 'site/privacy.html', notFound: 'site/404.html' },
    },
  },
}))
