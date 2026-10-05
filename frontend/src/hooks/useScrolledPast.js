import { useEffect, useState } from 'react';

/**
 * How far the page is scrolled. The page's scroller differs by width: on a
 * phone or tablet <body> scrolls (App.css, the mobile scroll fix), on a
 * desktop .app-content does, and the window itself barely ever. Reading
 * only window.scrollY saw 0 everywhere (Evoni, 2026-10-05), so the header
 * never collapsed. The largest of the candidates is the page's scroll.
 */
export function pageScrollTop() {
  if (typeof document === 'undefined') return 0;
  const content = document.querySelector('.app-content');
  return Math.max(
    window.scrollY || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0,
    content?.scrollTop || 0,
  );
}

/**
 * True while the page is scrolled more than `threshold` pixels down. The
 * episode page uses it to collapse its sticky header to the title and
 * navigation while scrolling (S9 b, Evoni 2026-10-02; §8(hh)).
 */
export default function useScrolledPast(threshold = 120) {
  const [past, setPast] = useState(() => pageScrollTop() > threshold);
  useEffect(() => {
    const onScroll = () => setPast(pageScrollTop() > threshold);
    onScroll();
    // Capture: a scroll on <body> or .app-content does not reach a window
    // listener; on the document in the capture phase it does.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);
  return past;
}
