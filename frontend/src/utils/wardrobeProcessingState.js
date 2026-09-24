/**
 * Wardrobe upload processing state (Task #1769).
 *
 * After an upload, createWardrobeItem (src/controllers/wardrobeController.js)
 * saves and returns the item, then removes the background in a detached
 * async block and writes s3_url_processed when it finishes. Nothing is
 * written when that block fails, and it does not run at all when the server
 * has no remove.bg key. So the URLs alone cannot tell "still working" from
 * "failed" from "never attempted".
 *
 * The create response now says whether that block was started
 * (`background_removal: 'started'`). Only items the server said it started
 * are tracked here; everything else shows no processing state. A tracked
 * item is:
 *   - 'ready'      once s3_url_processed exists
 *   - 'processing' until then, for up to PROCESSING_GIVE_UP_MS
 *   - 'stalled'    after that: the server's remove.bg call times out at 60s,
 *                  so no processed URL by then means the work did not finish.
 *                  This is inferred from elapsed time, not reported by the
 *                  server, and lasts only for this browser session.
 */

export const PROCESSING_POLL_INTERVAL_MS = 4000;
export const PROCESSING_GIVE_UP_MS = 150000;

export const PROCESSING_STATES = Object.freeze({
  NONE: 'none',
  PROCESSING: 'processing',
  READY: 'ready',
  STALLED: 'stalled',
});

/** True when the create response says background removal was started. */
export function backgroundRemovalStarted(createResponseBody) {
  return createResponseBody?.background_removal === 'started';
}

/**
 * Derive the processing state of one wardrobe item.
 *
 * @param {object} item     wardrobe row as the API returns it
 * @param {object} tracker  { startedAt:number, failed?:boolean, retrying?:boolean }
 *                          for an item this session uploaded and the server
 *                          started processing; undefined otherwise. `retrying`
 *                          is set while a Retry request is in flight — that
 *                          request answers for itself, so no time bound.
 * @param {number} now      epoch ms
 */
export function deriveProcessingState(item, tracker, now = Date.now()) {
  if (!item || !tracker) return PROCESSING_STATES.NONE;
  if (item.s3_url_processed) return PROCESSING_STATES.READY;
  if (!item.s3_url) return PROCESSING_STATES.NONE;
  if (tracker.retrying) return PROCESSING_STATES.PROCESSING;
  if (tracker.failed) return PROCESSING_STATES.STALLED;
  const started = Number(tracker.startedAt);
  if (!Number.isFinite(started)) return PROCESSING_STATES.NONE;
  if (now - started >= PROCESSING_GIVE_UP_MS) return PROCESSING_STATES.STALLED;
  return PROCESSING_STATES.PROCESSING;
}

/**
 * Ids worth polling right now: tracked, not retrying, not marked failed, and
 * still inside the give-up window. Sorted so the result is a stable key.
 */
export function pollableIds(trackers, now = Date.now()) {
  return Object.entries(trackers || {})
    .filter(([, t]) => t && !t.retrying && !t.failed
      && Number.isFinite(Number(t.startedAt))
      && now - Number(t.startedAt) < PROCESSING_GIVE_UP_MS)
    .map(([id]) => id)
    .sort();
}

/** The fields a finished background removal writes to the wardrobe row. */
export function pickProcessedFields(item) {
  const out = { id: item.id };
  ['s3_url_processed', 's3_key_processed', 's3_url_bg_pink', 's3_url_bg_blue', 's3_url_bg_teal', 'updated_at']
    .forEach((k) => { if (item[k] !== undefined) out[k] = item[k]; });
  return out;
}
