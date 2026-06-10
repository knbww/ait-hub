import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

export const isSentryEnabled = Boolean(dsn)

/** Initialise Sentry when a DSN is configured (production). No-op otherwise. */
export function initSentry() {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Error monitoring only for now; raise when tracing is wired up.
    tracesSampleRate: 0,
  })
}

/** Report an error to Sentry. No-op until initSentry() runs with a DSN. */
export function captureError(error: unknown) {
  Sentry.captureException(error)
}
