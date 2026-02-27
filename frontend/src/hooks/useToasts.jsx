/**
 * useToasts.js — Lightweight toast notification hook + container
 *
 * Usage:
 *   const toast = useToasts();
 *   toast.add('Saved!');            // success (default)
 *   toast.add('Oops', 'error');     // error
 *
 *   <ToastContainer toasts={toast.toasts} />
 */
import { useState, useCallback } from 'react';

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, add };
}

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="st-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`st-toast st-toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}
