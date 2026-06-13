import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ProfileRow, UserRole } from '../lib/db-rows'

export interface AuthValue {
  session: Session | null
  profile: ProfileRow | null
  role: UserRole
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>
  signInWithGitHub: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Re-fetch the signed-in member's profile (after editing name/avatar). */
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | undefined>(undefined)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
