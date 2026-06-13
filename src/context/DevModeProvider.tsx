import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { DevModeContext } from './devModeContext'

/**
 * Provides the dashboard "Layout mode" flag. Toggled from Settings or the global
 * Alt + Shift + Z shortcut.
 */
export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false)

  const toggleDevMode = useCallback(() => setIsDevMode((prev) => !prev), [])
  const setDevMode = useCallback((value: boolean) => setIsDevMode(value), [])

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

  return (
    <DevModeContext.Provider value={{ isDevMode, setDevMode, toggleDevMode }}>
      {children}
    </DevModeContext.Provider>
  )
}
