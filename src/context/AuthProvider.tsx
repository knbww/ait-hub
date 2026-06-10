import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
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

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
