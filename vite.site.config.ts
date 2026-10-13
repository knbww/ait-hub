import { defineConfig } from 'vite'

// The public club site (aitclub.org): a static page built separately from the Hub.
//   npx vite build --config vite.site.config.ts  →  dist-site/
export default defineConfig({
  root: 'site',
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
    rollupOptions: {
      // 404.html: Cloudflare Pages serves it for unknown paths (with a 404 status).
      input: { main: 'site/index.html', notFound: 'site/404.html' },
    },
  },
})
