import { createContext, useContext } from 'react'

export interface DevModeValue {
  isDevMode: boolean
}

export const DevModeContext = createContext<DevModeValue | undefined>(undefined)

export function useDevMode(): DevModeValue {
  const ctx = useContext(DevModeContext)
  if (!ctx) throw new Error('useDevMode must be used within a DevModeProvider')
  return ctx
}
