import { createContext, useContext } from 'react'

export interface DevModeValue {
  /** "Layout mode" — drag/hide/re-add dashboard cards. */
  isDevMode: boolean
  setDevMode: (value: boolean) => void
  toggleDevMode: () => void
}

export const DevModeContext = createContext<DevModeValue | undefined>(undefined)

export function useDevMode(): DevModeValue {
  const ctx = useContext(DevModeContext)
  if (!ctx) throw new Error('useDevMode must be used within a DevModeProvider')
  return ctx
}
