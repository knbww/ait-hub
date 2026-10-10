/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SENTRY_DSN?: string
  /** The club's address for the Hub, e.g. https://hub.aitclub.org. */
  readonly VITE_PUBLIC_ORIGIN?: string
  /** "true" in the demo copy (npm run demo): fictional data, one-click sign-in per role. */
  readonly VITE_DEMO?: string
  /** Cloudflare Turnstile site key: bot protection on sign-in and sign-up when set. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /** VAPID public key for push notifications (the private one is a Supabase function secret). */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
