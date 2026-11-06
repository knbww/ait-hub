import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether Supabase credentials are present. When false, data hooks fall back to
 * the bundled mock data so the app still runs without a connected project.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

// PKCE: a GitHub sign-in comes back with a one-time code, not with the tokens in the address.
export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, { auth: { flowType: 'pkce' } })
  : null
