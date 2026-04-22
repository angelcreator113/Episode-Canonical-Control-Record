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
// CSS `overscroll-behavior: contain` handles this on Chrome Android but iOS
// Safari has unreliable support. This JS fallback catches downward drags
// from the top of the page and preventDefault()s them before the browser
// interprets the gesture as a refresh.
//
// Safety rails: only fires when (a) the document is at scrollTop 0, AND
// (b) the gesture is downward, AND (c) no ancestor of the touch target
// has its own scrollTop > 0. Condition (c) preserves nested-container
// scrolling (modals, lists, carousels) — those can still handle their
// own touch events without the guard interfering.
(() => {
  let startY = 0;
  document.addEventListener('touchstart', (e) => {
    if (e.touches?.[0]) startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!e.touches?.[0]) return;
    const dy = e.touches[0].clientY - startY;
    const atTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    if (!atTop || dy <= 0) return;
    // Let nested scroll containers handle their own gestures. Walk up from
    // the touch target — if any ancestor has scrollTop > 0, bail without
    // calling preventDefault so it can scroll normally.
    let el = e.target;
    while (el && el !== document.body && el.nodeType === 1) {
      if (el.scrollTop > 0) return;
      el = el.parentElement;
    }
    e.preventDefault();
  }, { passive: false });
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
