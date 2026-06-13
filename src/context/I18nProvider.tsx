import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { messages } from '../lib/messages'
import type { Lang } from '../lib/messages'
import { I18nContext } from './i18nContext'

const STORAGE_KEY = 'ait_lang'

function initialLang(): Lang {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  return saved === 'en' ? 'en' : 'ru'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let str = messages[lang][key] ?? messages.ru[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return str
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
