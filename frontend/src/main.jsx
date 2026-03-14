import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

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
