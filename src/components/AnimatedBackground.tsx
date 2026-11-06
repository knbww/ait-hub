import { useEffect } from 'react'

/** The site's ground behind the whole app: paper, a dot grid and two slowly drifting glows. The blobs move by CSS transforms only, so
 * the browser never re-lays out the page for them; they stop while the tab is hidden and on weak
 * devices, and stand still for reduced-motion users (index.css). */
export function AnimatedBackground() {
  useEffect(() => {
    const root = document.documentElement
    if ((navigator.hardwareConcurrency ?? 8) <= 4) root.classList.add('bg-still')
    const sync = () => root.classList.toggle('bg-paused', document.hidden)
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  return (
    <div className="app-bg" aria-hidden="true">
      <span className="app-blob app-blob-1" />
      <span className="app-blob app-blob-2" />
      <div className="app-grid" />
    </div>
  )
}
