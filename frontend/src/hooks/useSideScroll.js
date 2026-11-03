/**
 * A row of tabs that slides sideways (Evoni, 2026-11-03: "usually I can move
 * it side to side but I can't. I have to click it"). The tab rows on the show
 * and episode pages scroll sideways but hide their scrollbars, so with a
 * mouse a row wider than the screen could not be moved at all.
 *
 * Attach the returned ref to the row (an element with overflow-x: auto). Then:
 * - a mouse drag slides it (a short press is still a click; a drag never clicks);
 * - the mouse wheel slides it while it has room to move, then scrolls the page;
 * - touch and trackpad swipes work as before (the browser's own scrolling);
 * - `edges` says whether there is more to the left and right, for a fade.
 *
 * Returns [ref, edges, className], className being 'side-scroll' plus
 * 'can-left' / 'can-right' (sideScroll.css draws the fades).
 */
import { useCallback, useRef, useState } from 'react';
import '../styles/sideScroll.css';

const DRAG_PX = 5;

export function sideEdges(el) {
  const max = el.scrollWidth - el.clientWidth;
  return { left: el.scrollLeft > 1, right: max > 1 && el.scrollLeft < max - 1 };
}

export default function useSideScroll() {
  const [edges, setEdges] = useState({ left: false, right: false });
  const cleanup = useRef(null);
  // Kept across re-attaching (a parent's re-render can hand the ref the same element again).
  const gesture = useRef({ drag: null, dragged: false });

  const ref = useCallback((el) => {
    if (cleanup.current) { cleanup.current(); cleanup.current = null; }
    if (!el) return;
    const update = () => {
      const next = sideEdges(el);
      setEdges((cur) => (cur.left === next.left && cur.right === next.right ? cur : next));
    };
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const before = el.scrollLeft;
      el.scrollLeft = before + e.deltaY;
      // Only take the wheel while the row moved; at its end the page scrolls.
      if (el.scrollLeft !== before) e.preventDefault();
    };
    const g = gesture.current;
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      g.drag = { x: e.clientX, left: el.scrollLeft };
      g.dragged = false;
    };
    const onMove = (e) => {
      if (!g.drag) return;
      const dx = e.clientX - g.drag.x;
      if (!g.dragged && Math.abs(dx) < DRAG_PX) return;
      g.dragged = true;
      el.classList.add('is-dragging');
      el.scrollLeft = g.drag.left - dx;
    };
    const onUp = () => {
      if (!g.drag) return;
      g.drag = null;
      el.classList.remove('is-dragging');
      // The click a drag ends with comes in this same turn; after it, nothing is the drag's
      // (a drag let go outside the row has no click, and must not eat the next one).
      if (g.dragged) setTimeout(() => { g.dragged = false; }, 0);
    };
    // A drag ends with a click on the tab under the pointer: that click is the drag's, not a choice.
    const onClick = (e) => {
      if (!g.dragged) return;
      g.dragged = false;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    // The first measure waits a tick: after layout, and never a state change inside React's commit.
    const first = setTimeout(update, 0);
    cleanup.current = () => {
      clearTimeout(first);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const className = `side-scroll${edges.left ? ' can-left' : ''}${edges.right ? ' can-right' : ''}`;
  return [ref, edges, className];
}
