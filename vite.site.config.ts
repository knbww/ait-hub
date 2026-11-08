import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// The public club site (aitclub.org): a static page built separately from the Hub.
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

export default defineConfig({
  root: 'site',
  define: { __BUILD__: JSON.stringify(`${commit}, ${day}`) },
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
    // Fonts stay files: the content policy has no data: in font-src.
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    rollupOptions: {
      // 404.html: Cloudflare Pages serves it for unknown paths (with a 404 status).
      input: { main: 'site/index.html', notFound: 'site/404.html' },
    },
  },
})
