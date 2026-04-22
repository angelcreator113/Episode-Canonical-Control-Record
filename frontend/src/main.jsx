import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Stale-chunk auto-recovery ────────────────────────────────────────────
// After a new deploy, Vite emits chunks with fresh content-hashed filenames
// and the old ones are removed from the server. If a user had the SPA open
// across the deploy, their cached index.html still points at the old chunk
// names; any lazy import fires off a fetch for a file that returns 404 and
// React throws "Failed to fetch dynamically imported module".
//
// We catch that one specific error shape and force a full reload so the
// browser picks up the new index.html (and therefore the new chunk names).
// sessionStorage guards against an infinite reload loop if the error is
// actually persistent (e.g. server genuinely down) — we only auto-reload
// once per session.
const RELOAD_FLAG = 'chunk-reload-attempted';
const isStaleChunkError = (err) => {
  const msg = (err?.message || err?.reason?.message || '').toLowerCase();
  return msg.includes('failed to fetch dynamically imported module')
      || msg.includes('importing a module script failed')
      || msg.includes('error loading dynamically imported module');
};
const tryReload = () => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;  // already tried this session
  sessionStorage.setItem(RELOAD_FLAG, '1');
  // Cache-bust on the reload too — query string forces the CDN to hand us
  // the latest index.html rather than the one it may have cached.
  window.location.replace(window.location.pathname + '?_chunk_reload=' + Date.now());
};
window.addEventListener('error', (e) => { if (isStaleChunkError(e)) tryReload(); });
window.addEventListener('unhandledrejection', (e) => { if (isStaleChunkError(e)) tryReload(); });

// ── Block mobile pull-to-refresh ───────────────────────────────────────────
// CSS `overscroll-behavior: none` should kill this on modern browsers, but
// iOS Safari and older Chrome occasionally still fire the gesture. This JS
// fallback preventDefault()s any downward drag that starts at the top of
// whatever scroll container owns the page, before the browser interprets it
// as refresh.
//
// Covers all three possible "root scroll element" sources because browsers
// disagree: some put the scroll on <html>, some on <body>, some expose it
// via document.scrollingElement. We take the max of all three scrollTops.
//
// Safety rails: only fires when
//   (a) the root scroll is at 0, AND
//   (b) the touch gesture is downward, AND
//   (c) no ancestor of the touch target has its own scrollTop > 0
// Condition (c) preserves nested container scrolling — modals, lists,
// carousels continue to receive their own touch events normally.
(() => {
  // Null (not 0) so touchmove can't fire before touchstart has set a real
  // start Y. Previous version initialised to 0, which meant any early
  // touchmove before touchstart was captured would see dy = clientY − 0 > 0
  // and preventDefault() all scrolling on the page.
  let startY = null;
  let trackedId = null;
  const MIN_DRAG_PX = 5;              // ignore jitter; only fire on real drags
  const rootScrollTop = () => Math.max(
    window.scrollY || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0,
    document.scrollingElement?.scrollTop || 0,
  );
  const resetTouch = () => { startY = null; trackedId = null; };

  document.addEventListener('touchstart', (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    startY = t.clientY;
    trackedId = t.identifier;
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', (e) => {
    if (startY == null) return;       // no start recorded — pass through
    const t = Array.from(e.touches || []).find(tt => tt.identifier === trackedId) || e.touches?.[0];
    if (!t) return;
    const dy = t.clientY - startY;
    // Only relevant for downward drags (pull-to-refresh direction), past
    // the jitter threshold so a static tap doesn't misfire.
    if (dy <= MIN_DRAG_PX) return;
    // Only when the document is at the very top.
    if (rootScrollTop() > 0) return;
    // Let nested scroll containers handle their own gestures. Walk up from
    // the touch target — if any ancestor has scrollTop > 0, bail without
    // calling preventDefault so it can scroll normally.
    let el = e.target;
    while (el && el !== document.body && el.nodeType === 1) {
      if (el.scrollTop > 0) return;
      el = el.parentElement;
    }
    e.preventDefault();
  }, { passive: false, capture: true });

  document.addEventListener('touchend', resetTouch, { passive: true, capture: true });
  document.addEventListener('touchcancel', resetTouch, { passive: true, capture: true });
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Service worker for offline story reading — production only
// In dev mode, unregister any existing SW to prevent stale cache issues
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(r => r.unregister())
    );
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
