/**
 * Service Worker — Offline story caching for LalaVerse
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS, fonts) → cache-first
 *   - API calls → network-first (fall through to cache if offline)
 *   - Story content saved explicitly via postMessage from the app
 */

const CACHE_NAME = 'lalaverse-v1';
const STORY_CACHE = 'lalaverse-stories-v1';

// App shell files to pre-cache on install
const APP_SHELL = [
  '/',
  '/index.html',
];

// ── Install: pre-cache app shell ───────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
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

// ── Fetch: network-first for API, cache-first for static ──────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
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
