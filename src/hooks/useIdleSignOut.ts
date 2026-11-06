import { useEffect } from 'react'
import { useAuth } from '../context/authContext'

// Director and curator work on shared school computers, and a session lasts until someone signs
// out. An hour without activity ends it, also when the browser was closed in between.

const KEY = 'ait-hub-last-active'
const LIMIT_MS = 60 * 60_000
const SAVE_EVERY_MS = 30_000
const EVENTS = ['pointerdown', 'keydown', 'scroll'] as const

function stored(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

function store(time: number) {
  try {
    localStorage.setItem(KEY, String(time))
  } catch {
    // Private mode: the timer below still works for this tab.
  }
}

export function useIdleSignOut(enabled: boolean) {
  const { session, signOut } = useAuth()
  const signedInAt = Date.parse(session?.user.last_sign_in_at ?? '') || 0

  useEffect(() => {
    if (!enabled) return
    let last = Math.max(stored(), signedInAt)
    const expired = () => Date.now() - Math.max(last, stored()) > LIMIT_MS
    if (expired()) {
      void signOut()
      return
    }

    const touch = () => {
      const now = Date.now()
      if (now - last < SAVE_EVERY_MS) return
      last = now
      store(now)
    }
    touch()
    const check = () => {
      if (expired()) void signOut()
    }
    const timer = setInterval(check, 60_000)
    for (const name of EVENTS) window.addEventListener(name, touch, { passive: true })
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      for (const name of EVENTS) window.removeEventListener(name, touch)
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled, signedInAt, signOut])
}
