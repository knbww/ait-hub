// Error reporting, only when a DSN is configured: without one the Sentry code isn't even
// downloaded (it is imported on demand).

const dsn = import.meta.env.VITE_SENTRY_DSN

export const isSentryEnabled = Boolean(dsn)

const sentry = dsn ? import('@sentry/react') : null

/** Initialise Sentry when a DSN is configured (production). No-op otherwise. */
export function initSentry() {
  if (!sentry) return
  void sentry.then((Sentry) =>
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Error monitoring only for now; raise when tracing is wired up.
      tracesSampleRate: 0,
    }),
  )
}

/** Report an error to Sentry. No-op without a DSN. */
export function captureError(error: unknown) {
  if (sentry) void sentry.then((Sentry) => Sentry.captureException(error))
}
