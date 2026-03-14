/**
 * PullToRefresh.jsx
 * Provides pull-to-refresh gesture for standalone PWA mode (no browser chrome).
 * Only activates when the page is scrolled to the top and the user pulls down.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const THRESHOLD = 80; // px to pull before triggering refresh

export default function PullToRefresh() {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const active = useRef(false);

  // Only enable in standalone mode (PWA) where there's no browser refresh
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches);

  const onTouchStart = useCallback((e) => {
    if (window.scrollY > 5) return; // only when at top
    startY.current = e.touches[0].clientY;
    active.current = true;
  }, []);

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
    if (!isStandalone) return;
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isStandalone, onTouchStart, onTouchMove, onTouchEnd]);

  if (!isStandalone || !pulling || pullDistance < 5) return null;

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
