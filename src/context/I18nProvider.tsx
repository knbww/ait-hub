import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { messages } from '../lib/messages'
import { plural } from '../lib/club'
import { I18nContext } from './i18nContext'

function fill(str: string, params?: Record<string, string | number>) {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

// The interface is Russian-only; keeping every string in lib/messages.ts makes proofreading
// one file and leaves room for another language later.
export function I18nProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const t = (key: string, params?: Record<string, string | number>) => fill(messages[key] ?? key, params)
    const tp = (key: string, n: number, params?: Record<string, string | number>) => {
      const form = plural(n, `${key}.one`, `${key}.few`, `${key}.many`)
      return fill(messages[form] ?? form, { n, ...params })
    }
    return { t, tp }
  }, [])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
