/**
 * usePhonePlaythrough — client-side binding to the server-side playable phone state.
 *
 * Loads/creates the per-user, per-episode state on mount, exposes `tap(zoneId)`
 * which hits the server (which runs the SAME phoneRuntime evaluator the editor
 * uses). The returned shape matches what PhonePreviewMode expects in its
 * `playthrough` prop so wiring is a one-liner.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function usePhonePlaythrough(episodeId) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial load — creates the row server-side if it doesn't exist.
  useEffect(() => {
    if (!episodeId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/api/v1/episodes/${episodeId}/phone-state`)
      .then(res => { if (!cancelled) setState(res.data?.state || null); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [episodeId]);

  // Tap a zone — server validates the condition, applies actions, persists state,
  // and returns { state, effects }. Client re-syncs state and the caller handles
  // effects (navigate / toasts / completion).
  const tap = useCallback(async (zoneId) => {
    if (!episodeId || !zoneId) return null;
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/phone-state/tap`, { zone_id: zoneId });
      const nextState = res.data?.state;
      const effects = res.data?.effects || { navigate: null, toasts: [], completeEpisode: false };
      if (nextState) setState(nextState);
      return { effects, state: nextState };
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      return null;
    }
  }, [episodeId]);

  const reset = useCallback(async () => {
    if (!episodeId) return;
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/phone-state/reset`);
      if (res.data?.state) setState(res.data.state);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [episodeId]);

  return { state, loading, error, tap, reset };
}
