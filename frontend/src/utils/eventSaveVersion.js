/**
 * Versioned event saves (Task #1788) — the client side of the stale-save
 * check in PUT /world/:showId/events/:eventId (src/utils/eventVersion.js).
 *
 * Every save sends the event's updated_at as this page last read it, under
 * EXPECTED_VERSION_KEY. The route refuses with 409 (code EVENT_CHANGED)
 * when the stored row is newer, and returns the current row.
 *
 * A newer row is not always a conflict. This page's own other actions
 * (generating an invitation, a venue, an overlay…) write the row through
 * other routes and bump updated_at too. So on a 409 the save is retried
 * once, with the current version, only when none of the fields it sends
 * changed since this page read them — then nobody's work is overwritten,
 * because a save sends only its own fields. When a sent field did change,
 * that is the same field edited in two places: the refusal stands, and the
 * page tells the person.
 *
 * Pure apart from the `put` function passed in.
 */
import { sameEditorValue } from './eventEditorChanges';

export const EXPECTED_VERSION_KEY = 'expected_updated_at';
export const STALE_SAVE_CODE = 'EVENT_CHANGED';
export const STALE_SAVE_MESSAGE =
  'This event was changed somewhere else after you opened it, so this save was not applied. '
  + 'Reload the event to see the latest version, then make your change again.';

/** True for the route's stale-save refusal. */
export function isStaleSaveError(err) {
  return err?.response?.status === 409 && err.response.data?.code === STALE_SAVE_CODE;
}

/** What to show the person for a failed save. */
export function saveErrorMessage(err, fallback = 'Save failed') {
  if (isStaleSaveError(err)) return err.response.data?.error || STALE_SAVE_MESSAGE;
  return err?.response?.data?.error || err?.message || fallback;
}

/**
 * True when every field in `body` has the same value in `current` (the row
 * as it is now) as in `base` (the row as this page read it).
 */
export function sentFieldsUnchanged(body, base, current) {
  if (!base || !current) return false;
  return Object.keys(body || {})
    .filter((key) => key !== EXPECTED_VERSION_KEY)
    .every((key) => sameEditorValue(base[key], current[key]));
}

/**
 * PUT `body` to `url` with the version this page read. On a stale refusal
 * whose sent fields are all unchanged, retries once with the current
 * version; otherwise the error is thrown for the caller to show.
 * No version (null/undefined) sends the body unversioned.
 */
export async function putEventVersioned(put, url, body, { version, base } = {}) {
  const send = (v) => put(url, v ? { ...body, [EXPECTED_VERSION_KEY]: v } : body);
  try {
    return await send(version);
  } catch (err) {
    if (!version || !isStaleSaveError(err)) throw err;
    const { event: current, current_updated_at: currentVersion } = err.response.data || {};
    if (!currentVersion || !sentFieldsUnchanged(body, base, current)) throw err;
    return send(currentVersion);
  }
}

/**
 * A per-event save queue for a page that saves field by field. Saves run
 * one at a time, in order, and each takes the version returned by the one
 * before it — so two quick saves from the same page never refuse each
 * other. `getBase` returns the row as the page last read or saved it.
 */
export function createEventSaveQueue(put, { getBase } = {}) {
  let version = null;
  let chain = Promise.resolve();
  return {
    setVersion(v) { version = v || null; },
    getVersion() { return version; },
    save(url, body) {
      const run = async () => {
        const res = await putEventVersioned(put, url, body, { version, base: getBase ? getBase() : null });
        const next = res?.data?.event?.updated_at;
        if (next) version = next;
        return res;
      };
      const p = chain.then(run, run);
      chain = p.catch(() => {});
      return p;
    },
  };
}
