import { useEffect, useState } from 'react';

/**
 * True while the page is scrolled more than `threshold` pixels down. The
 * episode page uses it to collapse its sticky header to the title and
 * navigation while scrolling (S9 b, Evoni 2026-10-02; §8(hh)).
 */
export default function useScrolledPast(threshold = 120) {
  const [past, setPast] = useState(() => (typeof window !== 'undefined' ? window.scrollY > threshold : false));
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return past;
}
