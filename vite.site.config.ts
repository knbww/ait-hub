import { defineConfig } from 'vite'

// The public club site (aitclub.org): a static page built separately from the Hub.
//   npx vite build --config vite.site.config.ts  →  dist-site/
export default defineConfig({
  root: 'site',
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
  },
})
