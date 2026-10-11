// After a new version of the Hub is published, a tab opened earlier asks for page files that no
// longer exist. Reloading once picks up the new version instead of showing an error page.

const KEY = 'ait-hub-reloaded-at'

/** Reloads the page unless it already did so a moment ago; true when it reloads. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
