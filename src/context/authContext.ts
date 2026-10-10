import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ProfileRow, Role } from '../lib/db'

export interface SignUpInput {
  email: string
  password: string
  fullName: string
  grade: number
  joinCode: string
  telegram: string
  photoConsent: boolean
  /** Cloudflare Turnstile token, when bot protection is on. */
  captchaToken?: string
}

export interface AuthValue {
  session: Session | null
  /** The signed-in member's profile; null while loading, signed out, or missing. */
  profile: ProfileRow | null
  /** True until the session (and, when signed in, the profile) has been resolved. */
  loading: boolean
  /** The profile request failed (network / server) — not the same as "no profile". */
  profileError: unknown
  role: Role | null
  /** Track lead, director or curator. */
  isStaff: boolean
  /** Director or curator — sees the whole club. */
  isOversight: boolean
  isDirector: boolean
  /** Signed in, has an authenticator app, but this session hasn't entered its code yet. */
  mfaPending: boolean
  /** This session was confirmed with an authenticator-app code. */
  mfaVerified: boolean
  /** Re-read the session's assurance level (after a code is confirmed or the factor removed). */
  refreshMfa: () => Promise<void>
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: unknown }>
  /** For members who already joined with a code: GitHub links to the account with the same email. */
  signInWithGitHub: () => Promise<{ error: unknown }>
  /** Error Supabase sent back from a GitHub sign-in (e.g. no club account for that email). */
  oauthError: string | null
  /** `needsConfirmation` when the project still requires email confirmation. */
  signUp: (input: SignUpInput) => Promise<{ error: unknown; needsConfirmation?: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | undefined>(undefined)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
