import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/nunito'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { queryClient } from './lib/queryClient'
import { initSentry } from './lib/sentry'
import { redirectToPublicOrigin } from './lib/origin'
import { registerServiceWorker } from './lib/install'
import { reloadForNewVersion } from './lib/staleVersion'

if (!redirectToPublicOrigin()) {
  initSentry()
  registerServiceWorker()
  // A page's files failed to preload: most likely a newer version was published meanwhile.
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault()
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
