import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { captureError } from '../lib/sentry'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message?: string
}

// The boundary lives outside the i18n provider (it must survive any render
// crash), so it reads the saved language directly.
const COPY = {
  ru: {
    title: 'Что-то пошло не так',
    text: 'Мы уже разбираемся. Можно перезагрузить страницу или вернуться на главную.',
    reload: 'Перезагрузить',
    home: 'На главную',
  },
  en: {
    title: 'Something went wrong',
    text: 'We are on it. Try reloading the page or heading back home.',
    reload: 'Reload',
    home: 'Home',
  },
}

function copy() {
  try {
    return localStorage.getItem('ait_lang') === 'en' ? COPY.en : COPY.ru
  } catch {
    return COPY.ru
  }
}

/** Catches render-time errors so a single failing subtree doesn't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unknown error' }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Render error:', error, info)
    captureError(error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const c = copy()

    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center bg-gradient-to-br from-gray-100 via-[#750014]/5 to-[#00B5AD]/10">
        <div className="max-w-md backdrop-blur-[40px] bg-white/60 border-2 border-white/80 rounded-3xl p-10 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="text-7xl mb-4 animate-bounce select-none">🤖💥</div>
          <h1 className="text-3xl font-light mb-2">{c.title}</h1>
          <p className="text-sm text-gray-600 mb-4">{c.text}</p>
          {this.state.message && (
            <p className="text-xs font-mono text-gray-400 bg-gray-900/5 rounded-lg px-3 py-2 mb-6 break-words">
              {this.state.message}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm hover:scale-105 transition-all duration-300"
            >
              {c.reload}
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="px-5 py-2 rounded-full border border-gray-900 text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
            >
              {c.home}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
