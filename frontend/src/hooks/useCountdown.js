import { useEffect, useState } from 'react';

/**
 * Seconds left until `until` (a ms timestamp), ticking once a second; 0 when
 * there is nothing to wait for. Counts from the clock, not from the ticks, so
 * a tab that was in the background still shows the right time. The timer
 * stops at 0 and is cleared on unmount or when `until` changes.
 */
export const secondsUntil = (until, now = Date.now()) => (
  until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
);

/** 272 → "4:32", 9 → "0:09", 3725 → "1:02:05". */
export const formatWait = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export default function useCountdown(until) {
  // The value is worked out from the clock on every render, so it is right on
  // the very render that sets `until` (a state copy would read 0 there first).
  // The interval only asks for a re-render once a second.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (secondsUntil(until) === 0) return undefined;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (secondsUntil(until) === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  return secondsUntil(until);
}
