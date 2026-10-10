// Cloudflare Turnstile site key (public). Bot protection on sign-in and sign-up is on only when
// it is set; Supabase then checks the token (Authentication → Bot and Abuse Protection).
export const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || null
