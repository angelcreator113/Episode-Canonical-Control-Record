/**
 * Rehearsal times per beat (Evoni, 2026-10-20): how long she spent on each
 * beat while the teleprompter ran, against the Script tab's estimate. Kept
 * for the session (sessionStorage) and, when she asks, on this device
 * (localStorage) per episode. No server.
 */
export const SESSION_KEY = (episodeId) => `teleprompter.rehearsal.session.${episodeId}`;
export const SAVED_KEY = (episodeId) => `teleprompter.rehearsal.${episodeId}`;

/** "1m 52s", "45s". */
export function durationText(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
}

/** "+22s", "−8s", "on time" against the estimate. */
export function diffText(actual, estimate) {
  const d = Math.round(Number(actual) || 0) - Math.round(Number(estimate) || 0);
  if (!d) return 'on time';
  return `${d > 0 ? '+' : '−'}${durationText(Math.abs(d))}`;
}

/** "Beat 8: 1m 52s · est. 1m 30s · +22s". */
export const rehearsalLine = (number, actual, estimate) => `Beat ${number}: ${durationText(actual)} · est. ${durationText(estimate)} · ${diffText(actual, estimate)}`;

export function readTimes(storage, key) {
  try {
    const raw = JSON.parse(storage?.getItem(key) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch (err) {
    console.error('[rehearsal] times not read:', err);
    return null;
  }
}

export function writeTimes(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch (err) {
    console.error('[rehearsal] times not kept:', err);
    return false;
  }
}
