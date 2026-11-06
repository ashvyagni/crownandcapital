/* Crown & Capital service worker — versioned cache with an offline shell. */
const VERSION = 'v1'
const CACHE = `crown-and-capital-${VERSION}`
const OFFLINE_FALLBACK = '/index.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(['/', '/index.html']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  let response
  try {
    response = await fetch(request)
  } catch {
    const fallback = await caches.match(OFFLINE_FALLBACK)
    return fallback ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
  if (response && response.ok) {
    const cache = await caches.open(CACHE)
    cache.put(request, response.clone()).catch(() => {})
  }
  if (request.mode === 'navigate' && !(response && response.ok)) {
    const fallback = await caches.match(OFFLINE_FALLBACK)
    if (fallback) return fallback
  }
  return response
}

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/ws')) return
  event.respondWith(cacheFirst(request))
})
