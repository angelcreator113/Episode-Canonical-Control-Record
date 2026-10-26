/**
 * What comes next for the event (Evoni, 2026-10-25: "I want them all"):
 * GET /world/:showId/events/:eventId/flow, read again after every save of
 * the page (reloadTick). { flow, error, reload }: flow is { beat14,
 * defaults, clashes, errors? } (a part that failed is null), or null while
 * the first read is out or when it failed. Never blocks the page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';

export default function useEventActions({ showId, eventId, reloadTick = 0 }) {
  const [flow, setFlow] = useState(null);
  const [error, setError] = useState(null);
  const seqRef = useRef(0);
  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${eventId}/flow`);
      if (seq !== seqRef.current) return;
      const body = res?.data || null;
      for (const [part, message] of Object.entries(body?.errors || {})) console.error(`[EventFlow] ${part} failed:`, message);
      setFlow(body);
      setError(null);
    } catch (err) {
      if (seq !== seqRef.current) return;
      console.error('[EventFlow] load failed:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load');
    }
  }, [showId, eventId]);
  useEffect(() => { reload(); }, [reload, reloadTick]);
  return { flow, error, reload };
}
