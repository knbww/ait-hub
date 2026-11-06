// Trusted Types: the browser refuses to turn a string into HTML or a script address unless a policy
// lets it. The Hub never writes HTML, so there is no createHTML here and any attempt fails; the only
// script addresses it needs are its service worker and the Turnstile widget. Imported first, before
// anything that might touch those.

const SCRIPTS = ['/sw.js', 'https://challenges.cloudflare.com/turnstile/v0/']

interface TrustedTypesFactory {
  createPolicy: (name: string, rules: { createScriptURL: (url: string) => string | null }) => unknown
}

const factory = (window as unknown as { trustedTypes?: TrustedTypesFactory }).trustedTypes

factory?.createPolicy('default', {
  createScriptURL: (url) => (SCRIPTS.some((allowed) => url.startsWith(allowed)) ? url : null),
})
