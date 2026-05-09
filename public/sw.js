// Service Worker — Task Manager PWA
// Versión de caché: incrementar para forzar actualización
const CACHE_NAME = 'taskmanager-v4';

// Recursos que se precargan en la instalación
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: precachear todos los recursos estáticos ──
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ── Activate: limpiar cachés antiguas ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache First para assets, Network First para navegación ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca cachear API: siempre red para evitar respuestas stale en sync/workspaces.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Solo interceptar peticiones same-origin
  if (url.origin !== location.origin) {
    // Para CDN externos (React, Babel, chrono): intentar red, fallback a caché
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => caches.match(request))
      )
    );
    return;
  }

  // Navegación: Network First (siempre intentar la red para obtener actualizaciones)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Recursos estáticos: Cache First
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
    )
  );
});
