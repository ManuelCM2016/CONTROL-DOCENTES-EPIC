/**
 * Service Worker — Control de Avance Silábico UPT
 * Garantiza funcionamiento 100% offline y carga ultrarrápida (PWA)
 */

const CACHE_NAME = 'epic-control-docente-v1.2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.svg',
  '/icons.svg',
]

// ── INSTALACIÓN: Precargar shell de la app en caché ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 [PWA Service Worker] Precargando recursos estáticos...')
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Algunos recursos no se pudieron precargar:', err)
      })
    }).then(() => self.skipWaiting())
  )
})

// ── ACTIVACIÓN: Limpiar cachés antiguas ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 [PWA Service Worker] Eliminando caché antigua:', key)
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// ── FETCH: Estrategia Stale-While-Revalidate para assets y Network-First para navegación ──
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)

  // No interceptar peticiones a Google Apps Script (se manejan vía offlineManager)
  if (requestUrl.hostname.includes('script.google.com') || requestUrl.hostname.includes('google.com')) {
    return
  }

  // Peticiones que no sean GET
  if (event.request.method !== 'GET') {
    return
  }

  // Navegación HTML o recursos de la app
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si está en caché, devolverlo y actualizar en background
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(() => {
          // Si falla la red y no hay caché, retornar fallback para navegación HTML
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html')
          }
        })

      return cachedResponse || fetchPromise
    })
  )
})
