const BUILD_ID = new URL(self.location.href).searchParams.get('build') || 'dev'
const CACHE_NAME = `instakids-shell-${BUILD_ID}`
const APP_SHELL = ['/pwa-192.png', '/pwa-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {}))
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('instakids-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/plat/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
        const cachedResponse = response.bodyUsed ? null : response.clone()
        if (cachedResponse) {
          caches.open(CACHE_NAME).then(cache => cache.put('/', cachedResponse)).catch(() => {})
        }
      }
      return response
    }).catch(async () => (await caches.match('/')) || Response.error()))
    return
  }

  if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pwa-') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(caches.match(request).then(async cached => {
      if (cached) return cached
      const response = await fetch(request)
      // HTML (404 sahifa) hech qachon JS/CSS sifatida keshlanmasin
      if (response.ok && !(response.headers.get('content-type') || '').includes('text/html')) {
        const cachedResponse = response.bodyUsed ? null : response.clone()
        if (cachedResponse) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, cachedResponse)).catch(() => {})
        }
      }
      return response
    }))
  }
})
