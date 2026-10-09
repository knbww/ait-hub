import { createContext, useContext } from 'react'

export interface I18nValue {
  /** Translate a key, with optional `{name}` interpolation params. */
  t: (key: string, params?: Record<string, string | number>) => string
  /** Plural form: picks `${key}.one | .few | .many` for `n` and fills `{n}`. */
  tp: (key: string, n: number, params?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18nValue | undefined>(undefined)

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
