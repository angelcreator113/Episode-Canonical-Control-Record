import { useEffect, useState } from 'react';

/**
 * Whether a header that scrolls with the page has gone far enough up for
 * its compact form to take over (Evoni, 2026-10-23: on her Android phone the
 * episode header "jumps" while scrolling).
 *
 * On a phone the episode's full header is about half the screen. It used to
 * stay pinned at full height until 120px of scroll, then snap to its compact
 * form, which left a blank band where the rest of it had been and moved the
 * view. Now the full header scrolls away with the page, and the compact one
 * takes over at the moment only its own height of the full header is still
 * showing. It sits exactly where that strip was, so nothing below it moves.
 *
 * `visible` is how much of the full header is still on screen below the
 * sticky line. It turns compact at `compactH` and back at
 * `compactH + release` (32px by default).
 */
export function nextCompact(was, visible, compactH, release = 32) {
  return was ? visible < compactH + release : visible <= compactH;
}

/**
 * `sentinelRef` is an empty element just before the header, so its top is
 * where the header starts in the page even while the header is stuck.
 * `fullHeight()` and `compactHeight()` return the header's measured heights;
 * `stickTop()` is where the compact header sticks (below the app header).
 */
export default function useHeaderScrolledAway({ enabled, sentinelRef, fullHeight, compactHeight, stickTop, release = 32, resetKey }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!enabled) { setCompact(false); return undefined; }
    let raf = 0;
    const check = () => {
      raf = 0;
      const s = sentinelRef.current;
      const full = fullHeight();
      if (!s || !full) return;
      const visible = s.getBoundingClientRect().top + full - stickTop();
      setCompact((was) => nextCompact(was, visible, compactHeight(), release));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    // Capture: on a phone <body> scrolls, and its scroll does not reach a
    // window listener (hooks/useScrolledPast.js).
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    check();
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // The getters read refs; resetKey re-runs this for a new episode.
  }, [enabled, release, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return compact;
}
