// AIT Hub service worker: the app starts without a connection (last loaded version) and shows
// push notifications. Supabase requests are never cached — data always comes from the server.

const CACHE = 'ait-hub-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Pages: network first, the last good copy when offline (every route is the same app shell).
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) (await caches.open(CACHE)).put('/', response.clone())
        return response
      } catch {
        return (await caches.match('/')) ?? Response.error()
      }
    })())
    return
  }

  // Built files carry a content hash: cache first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
      return response
    })())
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(self.registration.showNotification(data.title || 'AIT Hub', {
    body: data.body || '',
    tag: data.tag,
    lang: 'ru',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) return client.navigate(target)
        return undefined
      }
    }
    return self.clients.openWindow(target)
  })())
})
