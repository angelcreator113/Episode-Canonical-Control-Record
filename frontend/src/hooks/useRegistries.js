/**
 * useRegistries — Shared hook for fetching character registries
 *
 * Both CharacterGenerator and CharacterRegistryPage need the registry list
 * from /api/v1/character-registry/registries. This hook deduplicates that logic.
 *
 * Usage:
 *   const { registries, loading, error, refresh } = useRegistries();
 */

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '/api/v1';

export default function useRegistries() {
  const [registries, setRegistries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/character-registry/registries`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRegistries(data.registries || data || []);
    } catch (e) {
      console.error('Failed to fetch registries:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { registries, loading, error, refresh };
}
