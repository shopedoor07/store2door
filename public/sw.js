/// <reference lib="webworker" />

const CACHE_NAME = 'store2door-v1';
const STATIC_CACHE = 'store2door-static-v1';

// Static assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/login',
  '/register',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

// Install: precache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first with cache fallback for navigation
// Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls — always go to network
  if (url.hostname.includes('supabase')) return;

  // Skip Next.js HMR and internal routes in dev
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // Static assets (JS, CSS, images, fonts): cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|gif|ico|woff|woff2)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return response;
        });
      })
    );
    return;
  }

  // API routes: network only
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Try cache, then show offline page
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match('/').then((home) => home || new Response('Offline', { status: 503 }));
          });
        })
    );
    return;
  }
});
