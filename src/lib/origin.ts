// The club's own address for the Hub (VITE_PUBLIC_ORIGIN, e.g. https://hub.aitclub.org).
// Unset → whatever address the page was opened on.

const configured = import.meta.env.VITE_PUBLIC_ORIGIN?.replace(/\/+$/, '') || null

/** Origin for links that leave the screen — QR codes, copied join links. */
export const publicOrigin = configured ?? window.location.origin

/** The production *.pages.dev address; preview deployments live on subdomains of it. */
const PAGES_HOST = 'ait-hub.pages.dev'

/** Send visitors of the old pages.dev address to the club domain. Returns true when leaving. */
export function redirectToPublicOrigin(): boolean {
  if (!configured || window.location.hostname !== PAGES_HOST) return false
  const { pathname, search, hash } = window.location
  window.location.replace(`${configured}${pathname}${search}${hash}`)
  return true
}
