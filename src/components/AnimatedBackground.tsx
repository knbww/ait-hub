import { useEffect } from 'react'

/** Slowly drifting blurred colour behind the whole app. The blobs move by CSS transforms only, so
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
      <span className="app-blob app-blob-3" />
      <span className="app-blob app-blob-4" />
      <span className="app-blob app-blob-5" />
      {/* Softens the colour evenly on every page. */}
      <div className="absolute inset-0 bg-white/35" />
    </div>
  )
}
