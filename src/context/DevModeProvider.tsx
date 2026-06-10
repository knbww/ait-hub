import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { DevModeContext } from './devModeContext'

/**
 * Provides the dashboard "Developer Mode" flag and wires the global
 * Alt + Shift + Z shortcut that toggles it.
 */
export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + Shift + Z
      if (e.altKey && e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault()
        setIsDevMode((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <DevModeContext.Provider value={{ isDevMode }}>{children}</DevModeContext.Provider>
}
