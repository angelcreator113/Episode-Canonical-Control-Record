/**
 * Keeps the screen on while `active` (Teleprompter audit 3, Evoni,
 * 2026-10-24: a phone that locks mid-take ends the take): the Screen Wake
 * Lock (navigator.wakeLock.request('screen')), asked again each time the
 * page comes back into view (the browser drops it when the page hides), and
 * let go when `active` goes false or on leaving. Where the browser has no
 * wake lock, nothing happens. Returns whether the lock is held.
 */
import { useEffect, useState } from 'react';

export default function useWakeLock(active) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const wl = typeof navigator !== 'undefined' ? navigator.wakeLock : null;
    if (!active || !wl || typeof wl.request !== 'function') return undefined;
    let live = true;
    let lock = null;
    const ask = async () => {
      if (document.visibilityState === 'hidden' || (lock && !lock.released)) return;
      try {
        const got = await wl.request('screen');
        if (!live) { got.release?.().catch?.((err) => console.error('[useWakeLock] not released:', err)); return; }
        lock = got;
        setHeld(true);
        got.addEventListener?.('release', () => { if (live) setHeld(false); });
      } catch (err) {
        console.warn('[useWakeLock] the screen may lock:', err?.name || err);
        if (live) setHeld(false);
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') ask(); };
    ask();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisibility);
      setHeld(false);
      if (lock && !lock.released) {
        Promise.resolve(lock.release?.()).catch((err) => console.error('[useWakeLock] not released:', err));
      }
    };
  }, [active]);
  return held;
}
