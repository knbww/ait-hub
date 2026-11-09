// The «Join Our Team» form on aitclub.org/team: Turnstile, then submit_application (handler.ts).
//
// Secrets: TEAM_TURNSTILE_SECRET (the secret of the Turnstile widget the site uses: the Hub's, with
// aitclub.org added to its hostnames). Optional:
// TEAM_SITE_ORIGINS and TEAM_TURNSTILE_HOSTNAMES, comma-separated, for another address of the site.
// Deployed without JWT verification (supabase/config.toml): visitors have no session.

import { createClient } from 'npm:@supabase/supabase-js@2.108.1'
import { handle } from './handler.ts'

/** The new key variables hold JSON like {"default": "sb_secret_…"}. */
function key(name: string): string {
  const raw = Deno.env.get(name) ?? ''
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return parsed
    const first = Object.values(parsed ?? {})[0]
    return typeof first === 'string' ? first : ''
  } catch {
    return raw
  }
}

const list = (name: string, fallback: string) =>
  (Deno.env.get(name) ?? fallback).split(',').map((s) => s.trim()).filter(Boolean)

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  key('SUPABASE_SECRET_KEYS') || (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const deps = {
  secret: Deno.env.get('TEAM_TURNSTILE_SECRET') ?? '',
  origins: list('TEAM_SITE_ORIGINS', 'https://aitclub.org,https://www.aitclub.org'),
  hostnames: list('TEAM_TURNSTILE_HOSTNAMES', 'aitclub.org,www.aitclub.org'),
  rpc: (name: string, args: Record<string, unknown>) => admin.rpc(name, args),
  fetch,
}

Deno.serve((req) => handle(req, deps))
