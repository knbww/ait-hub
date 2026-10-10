import { useEffect, useRef } from 'react'
import { captchaSiteKey } from '../lib/captcha'

// Cloudflare Turnstile in front of sign-in and sign-up (see lib/captcha.ts).

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptLoading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoading = null
      reject(new Error('captcha_load_failed'))
    }
    document.head.appendChild(script)
  })
  return scriptLoading
}

/** `onToken` must be stable (a state setter); bump `resetKey` after a failed attempt — a token works once. */
export function Captcha({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)

  useEffect(() => {
    if (!captchaSiteKey) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return
        widget.current = window.turnstile.render(container.current, {
          sitekey: captchaSiteKey,
          language: 'ru',
          theme: 'light',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => onToken(null))
    return () => {
      cancelled = true
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [onToken])

  useEffect(() => {
    if (!resetKey || !widget.current || !window.turnstile) return
    window.turnstile.reset(widget.current)
    onToken(null)
  }, [resetKey, onToken])

  if (!captchaSiteKey) return null
  return <div ref={container} className="min-h-[65px] flex justify-center" />
}
