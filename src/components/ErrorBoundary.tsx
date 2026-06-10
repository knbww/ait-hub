import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message?: string
}

/** Catches render-time errors so a single failing subtree doesn't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unknown error' }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // TODO(Phase 1): forward to Sentry with the request correlation id.
    console.error('Render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 text-center">
          <div className="max-w-md backdrop-blur-[40px] bg-white/60 border-2 border-white/80 rounded-3xl p-8 shadow-lg">
            <h1 className="text-2xl font-light mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-gray-900 rounded-lg text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
