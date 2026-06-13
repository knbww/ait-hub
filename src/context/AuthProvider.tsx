import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { REFERRAL_STORAGE_KEY } from '../lib/referral'
import { AuthContext } from './authContext'
import type { AuthValue } from './authContext'
import type { ProfileRow } from '../lib/db-rows'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  // Only "loading" while a configured client resolves its initial session.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  // Track the auth session.
  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    let active = true
    void sb.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Load the linked profile (and role) whenever the session changes.
  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    let active = true
    void (async () => {
      if (!session) {
        if (active) setProfile(null)
        return
      }
      const { data } = await sb
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (active) setProfile((data as ProfileRow | null) ?? null)
    })()
    return () => {
      active = false
    }
  }, [session])

  // Claim a captured referral once the member is signed in (idempotent — the
  // RPC no-ops if they're already attributed). Keeps the code on a transient
  // 'unauthenticated' result so it can retry on the next session.
  useEffect(() => {
    if (!supabase || !session) return
    const code = localStorage.getItem(REFERRAL_STORAGE_KEY)
    if (!code) return
    const sb = supabase
    void (async () => {
      const { data } = await sb.rpc('claim_referral', { p_code: code })
      if (data !== 'unauthenticated') localStorage.removeItem(REFERRAL_STORAGE_KEY)
    })()
  }, [session])

  const signInWithPassword = useCallback<AuthValue['signInWithPassword']>(async (email, password) => {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUpWithPassword = useCallback<AuthValue['signUpWithPassword']>(
    async (email, password, fullName) => {
      if (!supabase) return { error: 'Supabase is not configured.' }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      return { error: error?.message ?? null }
    },
    [],
  )

  const signInWithGitHub = useCallback<AuthValue['signInWithGitHub']>(async () => {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session) return
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setProfile((data as ProfileRow | null) ?? null)
  }, [session])

  const signOut = useCallback(async () => {
    // Clear local UI state first so sign-out is instant and deterministic.
    setSession(null)
    setProfile(null)
    if (!supabase) return
    // scope: 'local' drops the stored session without the global server revoke,
    // which can 403 on an already-expired token and leave the user "stuck" in.
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const value: AuthValue = {
    session,
    profile,
    role: profile?.role ?? 'member',
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithGitHub,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
