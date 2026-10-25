/**
 * Suggest names (Task #1670), moved out of EventPackagePage.jsx (Task #54).
 * Nothing here fires on mount — only openNameSuggest, called from a click,
 * ever requests suggestions.
 */
import { useState } from 'react';
import api from '../../services/api';

export default function useNameSuggest({ showId, eventId, putEvent, load, setToast }) {
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [nameSuggesting, setNameSuggesting] = useState(false);
  const [nameSuggestError, setNameSuggestError] = useState(null);
  const [customName, setCustomName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const fetchNameSuggestions = async () => {
    setNameSuggesting(true);
    setNameSuggestError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/suggest-names`);
      setNameSuggestions(res.data?.names || []);
    } catch (err) {
      console.error('[EventPackage] fetchNameSuggestions failed:', err);
      setNameSuggestError(err.response?.data?.error || err.message || 'Failed to suggest names');
    } finally {
      setNameSuggesting(false);
    }
  };

  const openNameSuggest = () => {
    setNameSuggestOpen(true);
    if (nameSuggestions.length === 0 && !nameSuggesting) fetchNameSuggestions();
  };

  const saveEventName = async (newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || nameSaving) return;
    setNameSaving(true);
    try {
      await putEvent({ name: trimmed });
      setToast(`Name changed to "${trimmed}"`);
      setNameSuggestOpen(false);
      setNameSuggestions([]);
      setCustomName('');
      await load();
    } catch (err) {
      console.error('[EventPackage] saveEventName failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to save name');
    } finally {
      setNameSaving(false);
    }
  };

  return {
    nameSuggestOpen, setNameSuggestOpen, nameSuggestions, nameSuggesting, nameSuggestError,
    customName, setCustomName, nameSaving, fetchNameSuggestions, openNameSuggest, saveEventName,
  };
}
