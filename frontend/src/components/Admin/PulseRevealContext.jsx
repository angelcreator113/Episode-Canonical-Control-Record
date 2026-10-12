/**
 * The show's reveals for Admin › The Pulse (Task 2940; The Pulse spec §5;
 * /api/v1/pulse-reveals). One provider per show loads the reveals and the
 * episodes once; every RevealPicker reads and saves through it. A picker
 * outside a provider renders nothing, so the cards it sits in still work
 * alone.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { revealKey } from '../../lib/pulseReveals';

const RevealContext = createContext(null);

export const useReveals = () => useContext(RevealContext);

export function PulseRevealProvider({ showId, children }) {
  const [reveals, setReveals] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        api.get(`/api/v1/pulse-reveals?show_id=${encodeURIComponent(showId)}`),
        api.get(`/api/v1/episodes?show_id=${encodeURIComponent(showId)}&limit=100&sort=episode_number:ASC`),
      ]);
      setReveals(r.data?.reveals || []);
      setEpisodes((e.data?.data || []).filter((ep) => Number.isInteger(ep.episode_number)));
      setLoadError(null);
    } catch (err) {
      console.error('[PulseReveals] the reveals could not be read:', err.response?.status || err.message);
      setLoadError('The reveals could not be loaded.');
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const value = useMemo(() => {
    const byKey = new Map(reveals.filter((r) => r.item_type !== 'character').map((r) => [revealKey(r.item_type, r.item_id, r.image_kind), r]));
    return {
      showId,
      episodes,
      loadError,
      revealOf: (type, id, kind) => byKey.get(revealKey(type, id, kind)) || null,
      /** Saves one item's reveal; returns the saved reveal (with its label). */
      save: async (body) => {
        const res = await api.put('/api/v1/pulse-reveals', { show_id: showId, ...body });
        const saved = res.data?.reveal;
        setReveals((list) => [...list.filter((r) => r.id !== saved.id), saved]);
        return saved;
      },
      clear: async (id) => {
        await api.delete(`/api/v1/pulse-reveals/${id}`);
        setReveals((list) => list.filter((r) => r.id !== id));
      },
      reload: load,
    };
  }, [reveals, episodes, loadError, showId, load]);

  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}
