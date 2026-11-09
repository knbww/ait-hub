/// <reference types="vite/client" />

// Public values baked into the club site at build time (vite.site.config.ts refuses to build without them).
interface ImportMetaEnv {
  /** The Supabase project: the form talks to its `apply` function. */
  readonly VITE_SUPABASE_URL?: string
  /** Cloudflare Turnstile site key: the Hub's widget, with aitclub.org added to its hostnames. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /** A separate widget for the site, if one is ever wanted; overrides the Hub's key. */
  readonly VITE_TEAM_TURNSTILE_SITE_KEY?: string
  /** Where applicants ask questions and withdraw consent: @telegram, an email or an https address. */
  readonly VITE_TEAM_CONTACT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
