/**
 * PullToRefresh.jsx
 * Provides pull-to-refresh gesture on mobile devices.
 * Activates when the scroll container (.app-content) is at the top and the user pulls down.
 * On desktop, the browser's native refresh (F5 / Cmd+R) is sufficient.
 *
 * It refreshed by accident while scrolling (Evoni, 2026-10-05): a page at the
 * top could hold a panel, list or modal of its own that was scrolled down,
 * and scrolling that panel back up with the finger moving down read as a
 * pull. A pull now counts only when nothing under the finger is scrolled
 * (`scrolledAncestor`), at the start and all the way through, only while the
 * drag is mostly vertical, and only past a longer pull (THRESHOLD).
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export const THRESHOLD = 120; // damped px (finger travel x 0.5) before a refresh; was 80

/** True when the touch target, or any element above it, is scrolled down. */
export function scrolledAncestor(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

export default function PullToRefresh() {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const startX = useRef(0);
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
    if (scrolledAncestor(e.target)) return; // a panel under the finger is scrolled: that is a scroll
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    active.current = true;
  }, [getScrollTop]);

  const onTouchMove = useCallback((e) => {
    if (!active.current) return;
    const dy = e.touches[0].clientY - startY.current;
    const dx = e.touches[0].clientX - startX.current;
    // Cancel on an upward drag, a sideways swipe, or once anything under the finger scrolls.
    if (dy < 0 || (Math.abs(dx) > 10 && Math.abs(dx) > dy) || scrolledAncestor(e.target)) {
      active.current = false; setPulling(false); setPullDistance(0); return;
    }
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
