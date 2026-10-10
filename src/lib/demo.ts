// The demo copy of the Hub (`npm run demo`): its own Supabase project filled by supabase/seed.sql
// with fictional people. Built with VITE_DEMO=true, it shows a banner and one-click sign-in for
// each role. The real Hub is never built with it.

export const isDemo = import.meta.env.VITE_DEMO === 'true'

/** Shared by every account in supabase/seed.sql. */
export const DEMO_PASSWORD = 'demo-ait-2026'

export const DEMO_ACCOUNTS = [
  { label: 'demo.director', email: 'director@demo.aitclub.org' },
  { label: 'demo.curator', email: 'curator@demo.aitclub.org' },
  { label: 'demo.leadAi', email: 'lead.ai@demo.aitclub.org' },
  { label: 'demo.memberAi', email: 'aruzhan@demo.aitclub.org' },
  { label: 'demo.memberAlgo', email: 'nursultan@demo.aitclub.org' },
  { label: 'demo.memberStartup', email: 'alikhan@demo.aitclub.org' },
] as const
