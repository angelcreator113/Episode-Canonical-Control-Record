import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import {
  PROCESSING_POLL_INTERVAL_MS,
  deriveProcessingState,
  pollableIds,
  pickProcessedFields,
} from '../utils/wardrobeProcessingState';

// Module-scope API helpers (Api suffix, same pattern as WorldAdmin's helpers).
export const getWardrobeItemApi = (itemId) =>
  api.get(`/api/v1/wardrobe/${itemId}`).then((r) => r.data);
export const retryWardrobeBackgroundApi = (itemId) =>
  api.post(`/api/v1/wardrobe/${itemId}/process-background`).then((r) => r.data);

/**
 * Track wardrobe uploads whose background removal is still running
 * (Task #1769). See utils/wardrobeProcessingState for how state is derived.
 *
 * Only ids passed to track() are ever polled. Polling runs every
 * PROCESSING_POLL_INTERVAL_MS, stops for an item once its processed URL
 * appears or the give-up window passes, and stops entirely on unmount.
 *
 * @param {(patch: object) => void} onItemUpdate  merges { id, ...fields } into
 *   the caller's item list, so the card swaps to the processed image.
 */
export default function useWardrobeProcessing(onItemUpdate) {
  const [trackers, setTrackers] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const onUpdateRef = useRef(onItemUpdate);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(new Set());

  useEffect(() => { onUpdateRef.current = onItemUpdate; }, [onItemUpdate]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const untrack = useCallback((id) => {
    setTrackers((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const track = useCallback((id) => {
    if (!id) return;
    const t = Date.now();
    setNow(t);
    setTrackers((prev) => ({ ...prev, [id]: { startedAt: t } }));
  }, []);

  const pendingKey = pollableIds(trackers, now).join(',');

  useEffect(() => {
    if (!pendingKey) return undefined;
    const ids = pendingKey.split(',');
    const tick = () => {
      setNow(Date.now());
      ids.forEach(async (id) => {
        if (inFlightRef.current.has(id)) return;
        inFlightRef.current.add(id);
        try {
          const body = await getWardrobeItemApi(id);
          const fresh = body?.data;
          if (!mountedRef.current) return;
          if (fresh?.s3_url_processed) {
            onUpdateRef.current?.(pickProcessedFields(fresh));
            untrack(id);
          }
        } catch (err) {
          console.warn(`[wardrobe] processing check failed for ${id}:`, err?.message);
          // A deleted item will never finish; stop asking about it.
          if (mountedRef.current && err?.response?.status === 404) untrack(id);
        } finally {
          inFlightRef.current.delete(id);
        }
      });
    };
    const handle = setInterval(tick, PROCESSING_POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [pendingKey, untrack]);

  const retry = useCallback(async (id) => {
    setTrackers((prev) => ({ ...prev, [id]: { startedAt: Date.now(), retrying: true } }));
    // The upload's removal may have finished after the give-up window.
    // Check first, so a Retry never pays remove.bg for a cutout that exists.
    try {
      const fresh = (await getWardrobeItemApi(id))?.data;
      if (!mountedRef.current) return;
      if (fresh?.s3_url_processed) {
        onUpdateRef.current?.(pickProcessedFields(fresh));
        untrack(id);
        return;
      }
    } catch (err) {
      console.warn(`[wardrobe] pre-retry check failed for ${id}:`, err?.message);
      if (!mountedRef.current) return;
      if (err?.response?.status === 404) { untrack(id); return; }
    }
    try {
      const body = await retryWardrobeBackgroundApi(id);
      if (!mountedRef.current) return;
      const url = body?.data?.s3_url_processed;
      if (url) {
        onUpdateRef.current?.({ id, s3_url_processed: url });
        untrack(id);
        return;
      }
      setTrackers((prev) => ({ ...prev, [id]: { startedAt: Date.now(), failed: true } }));
    } catch (err) {
      console.warn(`[wardrobe] background removal retry failed for ${id}:`, err?.response?.data?.message || err?.message);
      if (!mountedRef.current) return;
      setTrackers((prev) => ({ ...prev, [id]: { startedAt: Date.now(), failed: true } }));
    }
  }, [untrack]);

  const stateFor = useCallback(
    (item) => deriveProcessingState(item, item ? trackers[item.id] : undefined, now),
    [trackers, now]
  );

  return { stateFor, track, retry, dismiss: untrack };
}
