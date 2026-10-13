// The club's own address for the Hub (VITE_PUBLIC_ORIGIN, e.g. https://hub.aitclub.org).
// Unset → whatever address the page was opened on.

const configured = import.meta.env.VITE_PUBLIC_ORIGIN?.replace(/\/+$/, '') || null

/** Origin for links that leave the screen — QR codes, copied join links. */
export const publicOrigin = configured ?? window.location.origin

/** Another address that serves the same site and should send people to the club address: the
 * production *.pages.dev alias (previews live on its subdomains and are left alone). aitclub.org
 * itself is the club site, a separate Pages project. */
const ALIAS_HOSTS = ['ait-hub.pages.dev']

/** Redirect visitors of an alias address to the club address. Returns true when leaving. */
export function redirectToPublicOrigin(): boolean {
  if (!configured || !ALIAS_HOSTS.includes(window.location.hostname)) return false
  const { pathname, search, hash } = window.location
  window.location.replace(`${configured}${pathname}${search}${hash}`)
  return true
}
