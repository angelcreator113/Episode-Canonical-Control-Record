/**
 * The person read (Evoni, 2026-10-23, "one person page", then "shouldn't
 * this information be in other tabs instead of creating a new one?"): one
 * GET /api/v1/person/:id (routes/person.js) for the character page, whose
 * tabs each show their part of it: Overview the names and what the writers
 * know, Voice & Pulse their Pulse account, Connections each relationship's
 * stage and secrecy, Story & Events the episode history.
 *
 * usePerson(id) -> { person, error, reload }; person is null while loading
 * or after a failed read (error then says why).
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';

export const getPersonApi = (id) => apiClient.get(`${API_URL}/person/${id}`);

export default function usePerson(id) {
  const [person, setPerson] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await getPersonApi(id);
      setPerson(res?.data?.person || null);
    } catch (err) {
      console.error('[usePerson] load failed:', err);
      setPerson(null);
      setError(err?.response?.data?.error || 'Could not load what the writers know.');
    }
  }, [id]);
  useEffect(() => { reload(); }, [reload]);
  return { person, error, reload };
}
