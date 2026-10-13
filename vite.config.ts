import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** The content policy names exactly this build's Supabase project (the club's or the demo's), and
 * allows the error tracker only when a DSN is configured. */
function projectHeaders(mode: string): Plugin {
  let outDir = 'dist'
  return {
    name: 'project-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
      const file = `${outDir}/_headers`
      let headers = readFileSync(file, 'utf8')
      const host = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).host : null
      if (host) headers = headers.replaceAll('*.supabase.co', host)
      if (!env.VITE_SENTRY_DSN) headers = headers.replace(' https://*.sentry.io', '')
      writeFileSync(file, headers)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), projectHeaders(mode)],
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into separately-cacheable chunks.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          motion: ['framer-motion'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          sentry: ['@sentry/react'],
        },
      },
    },
  },
}))
