/**
 * Service Worker — Offline story caching for LalaVerse
 *
 * Strategy:
 *   - Navigation (HTML) → network-first (always get fresh index.html)
 *   - Hashed assets (/assets/*) → cache-first (content-hashed by Vite)
 *   - API calls → network-first (fall through to cache if offline)
 *   - Story content saved explicitly via postMessage from the app
 */

const CACHE_NAME = 'lalaverse-v3';
const STORY_CACHE = 'lalaverse-stories-v1';

// ── Install: skip waiting to activate immediately ──────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== STORY_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for HTML & API, cache-first for hashed assets ─
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML pages): always network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(request)
            .catch(() => undefined)
            .then((r) => r || caches.match('/index.html').catch(() => undefined))
            .then((r) => r || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
        )
    );
    return;
  }

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(request)
            .catch(() => undefined)
            .then((r) => r || new Response('{"error":"offline"}', {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }))
        )
    );
    return;
  }

  // Hashed static assets (/assets/*): cache-first (Vite content-hashes these)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request)
        .catch(() => undefined)
        .then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
            }
            return res;
          });
        })
        .catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(request)
          .catch(() => undefined)
          .then((r) => r || new Response('', { status: 503 }))
      )
  );
});

// ── Message handler: cache/retrieve stories explicitly ─────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'CACHE_STORY') {
    // payload: { id, title, text, metadata }
    caches.open(STORY_CACHE).then((cache) => {
      const response = new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      });
      cache.put(`/offline-stories/${payload.id}`, response);
    });
  }

  if (type === 'GET_CACHED_STORIES') {
    caches.open(STORY_CACHE).then(async (cache) => {
      const keys = await cache.keys();
      const stories = await Promise.all(
        keys.map(async (req) => {
          const res = await cache.match(req);
          return res ? res.json() : null;
        })
      );
      event.source.postMessage({
        type: 'CACHED_STORIES',
        stories: stories.filter(Boolean),
      });
    });
  }

  if (type === 'DELETE_CACHED_STORY') {
    caches.open(STORY_CACHE).then((cache) => {
      cache.delete(`/offline-stories/${payload.id}`);
    });
  }
});
