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
import apiClient from '../services/api';

const API = import.meta.env.VITE_API_URL || '/api/v1';

// File-local cross-CP duplicate per v2.12 §9.11 — listRegistriesApi
// reaches 7-fold cross-CP existence after CP15 (8-fold including
// MemoryBankView). v2.17 §9.11 6-fold ceiling exceeded; Path A
// (continue file-local convention) per CP15 Decision 2 / v2.22 §9.11.
export const listRegistriesApi = () =>
  apiClient.get(`${API}/character-registry/registries`).then((r) => r.data);

export default function useRegistries() {
  const [registries, setRegistries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRegistriesApi();
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
