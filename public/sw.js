// Leverage AI — Service Worker v1
// Strategies:
//   - API routes (/api/*): network-first with offline JSON fallback
//   - Static assets (_next/static, images): cache-first
//   - Pages: stale-while-revalidate with offline page fallback

const CACHE_VERSION = 'leverage-ai-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  OFFLINE_URL,
];

// Static asset patterns to cache aggressively
const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\/icons\//,
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf)$/i,
];

// ─── Install ──────────────────────────────────────────────────────────────────
// Do NOT call self.skipWaiting() here. Calling it immediately causes every open
// tab to re-register and re-fire all page-load API calls in the same second
// (the "SW update storm" visible in logs). Instead we wait for an explicit
// SKIP_WAITING message from the client before activating the new worker.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Intentionally omitting self.skipWaiting() — see comment above.
});

// ─── Message: client-triggered skip-waiting ───────────────────────────────────
// The PWARegister component posts { type: 'SKIP_WAITING' } after detecting a
// new version. This gates the takeover so it only happens once and deliberately.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs (skip POST/PUT/DELETE and cross-origin)
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // ── API routes: network-first, offline JSON stub ───────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            success: false,
            error: 'You are offline. Please check your connection.',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'X-Served-By': 'ServiceWorker-Offline',
            },
          }
        )
      )
    );
    return;
  }

  // ── Static assets: cache-first ────────────────────────────────────────────
  if (STATIC_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Pages: stale-while-revalidate, offline fallback ───────────────────────
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Serve offline page for navigation requests
          if (request.mode === 'navigate') {
            const offlinePage = await caches.match(OFFLINE_URL);
            if (offlinePage) return offlinePage;
          }
          return new Response('Offline', { status: 503 });
        });

      return cached || networkFetch;
    })
  );
});
