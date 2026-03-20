/**
 * PullToRefresh.jsx
 * Provides pull-to-refresh gesture on mobile devices.
 * Activates when the scroll container (.app-content) is at the top and the user pulls down.
 * On desktop, the browser's native refresh (F5 / Cmd+R) is sufficient.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const THRESHOLD = 80; // px to pull before triggering refresh

export default function PullToRefresh() {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const active = useRef(false);

  // Enable on any touch device (mobile / tablet), not just standalone PWA
  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const getScrollTop = useCallback(() => {
    // On mobile the body is the scroll container; on desktop .app-content is.
    // Check both and return whichever is non-zero (or the body fallback).
    const appContent = document.querySelector('.app-content');
    const contentScroll = appContent ? appContent.scrollTop : 0;
    return Math.max(window.scrollY, document.documentElement.scrollTop, contentScroll);
  }, []);

  const onTouchStart = useCallback((e) => {
    if (getScrollTop() > 5) return; // only when scroll container is at top
    startY.current = e.touches[0].clientY;
    active.current = true;
  }, [getScrollTop]);

  const onTouchMove = useCallback((e) => {
    if (!active.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) { active.current = false; setPulling(false); setPullDistance(0); return; }
    setPulling(true);
    setPullDistance(Math.min(dy * 0.5, THRESHOLD + 20)); // damped
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    if (pullDistance >= THRESHOLD) {
      window.location.reload();
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance]);

  useEffect(() => {
    if (!isTouchDevice) return;
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isTouchDevice, onTouchStart, onTouchMove, onTouchEnd]);

  if (!isTouchDevice || !pulling || pullDistance < 5) return null;

  const ready = pullDistance >= THRESHOLD;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      display: 'flex', justifyContent: 'center',
      paddingTop: pullDistance - 20,
      transition: pulling ? 'none' : 'padding-top 0.2s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: ready ? '#22c55e' : '#e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: ready ? '#fff' : '#9ca3af',
        transition: 'background 0.15s, transform 0.15s',
        transform: `rotate(${ready ? 180 : 0}deg)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        ↓
      </div>
    </div>
  );
}
