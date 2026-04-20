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
