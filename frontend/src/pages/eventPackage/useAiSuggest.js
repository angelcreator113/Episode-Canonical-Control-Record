/**
 * Suggest with AI (Evoni, 2026-10-23: "use real AI for the suggestions"),
 * moved out of EventPackagePage.jsx (Task #54). Asks the server for the
 * empty fields (or all six, for new ideas when none is empty); the review
 * list then shows each with a checkbox, beside the page's own suggestions
 * the AI did not cover. Nothing is written until Save checked, which writes
 * every checked value in one PUT.
 */
import { useState } from 'react';
import api from '../../services/api';
import { hasValueState } from '../../utils/eventBasics';
import { buildCreatorOrganizerUpdate } from '../../utils/eventOrganizer';
import { BASICS_FIELDS, BASICS_PAGE_ORDER, AI_FIELD_TO_BASICS } from '../../lib/eventPackageFields';

export default function useAiSuggest({ showId, eventId, event, basics, used, startedFrom, organizer, putEvent, load, setToast }) {
  // idle | loading | review | error, the review's rows, whether the AI had
  // nothing new, and the error text.
  const [aiSuggest, setAiSuggest] = useState({ status: 'idle', rows: [], aiEmpty: false, error: null, n: 0 });
  const [suggestSaving, setSuggestSaving] = useState(false);

  const factsRows = (covered) => {
    const rows = BASICS_PAGE_ORDER
      .filter((key) => basics[key]?.state === 'suggested' && basics[key].suggestion && !covered.has(key))
      .map((key) => ({
        id: `facts-${key}`, key, source: 'facts', label: BASICS_FIELDS[key].label, spec: BASICS_FIELDS[key],
        value: basics[key].suggestion.value, reason: basics[key].suggestion.basis || '',
      }));
    if (startedFrom?.suggestOrganizer && organizer && !organizer.hasOrganizer) {
      const update = buildCreatorOrganizerUpdate(event, startedFrom.profile);
      if (!update.unchanged) {
        rows.push({
          id: 'facts-organizer', key: 'organizer', source: 'facts', fixed: true, label: 'Organizer',
          value: startedFrom.name, display: `${startedFrom.name} (creator)`, update,
          reason: 'You started this event from their Pulse profile',
        });
      }
    }
    return rows;
  };
  const askAiSuggestions = async () => {
    if (used || aiSuggest.status === 'loading') return;
    const empty = Object.entries(AI_FIELD_TO_BASICS).filter(([, key]) => !hasValueState(basics[key]?.state)).map(([col]) => col);
    setAiSuggest((st) => ({ ...st, status: 'loading', error: null }));
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/suggest-basics`,
        empty.length ? {} : { fields: Object.keys(AI_FIELD_TO_BASICS) });
      const list = Array.isArray(res.data?.data?.suggestions) ? res.data.data.suggestions : [];
      const aiRows = list
        .map((sg, i) => {
          const key = AI_FIELD_TO_BASICS[sg?.field];
          if (!key || sg.value === undefined || sg.value === null || String(sg.value).trim() === '') return null;
          return {
            id: `ai-${key}-${i}`, key, source: 'ai', label: BASICS_FIELDS[key].label, spec: BASICS_FIELDS[key],
            value: String(sg.value), reason: sg.reason ? String(sg.reason) : '',
          };
        })
        .filter(Boolean);
      const covered = new Set(aiRows.map((r) => r.key));
      setAiSuggest((st) => ({ status: 'review', rows: [...aiRows, ...factsRows(covered)], aiEmpty: aiRows.length === 0, error: null, n: st.n + 1 }));
    } catch (err) {
      console.error('[EventPackage] suggest basics failed:', err);
      const status = err.response?.status;
      const serverText = err.response?.data?.error;
      const message = (status === 429 || status === 402 || status === 502) && serverText
        ? serverText
        : 'Couldn’t get suggestions right now. Try again in a moment.';
      setAiSuggest((st) => ({ ...st, status: 'error', error: message }));
    }
  };
  const closeAiSuggestions = () => {
    if (suggestSaving) return;
    setAiSuggest((st) => ({ ...st, status: 'idle', rows: [], aiEmpty: false, error: null }));
  };
  const saveCheckedSuggestions = async (checked) => {
    if (used || suggestSaving || !checked.length) return;
    const body = {};
    for (const row of checked) {
      if (row.key === 'organizer') Object.assign(body, row.update.body);
      else body[BASICS_FIELDS[row.key].column] = row.value;
    }
    setSuggestSaving(true);
    try {
      await putEvent(body);
      setAiSuggest((st) => ({ ...st, status: 'idle', rows: [], aiEmpty: false, error: null }));
      setToast(`Saved ${checked.length} suggestion${checked.length === 1 ? '' : 's'}`);
      await load();
    } catch (err) {
      console.error('[EventPackage] save suggestions failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to save the suggestions');
    } finally {
      setSuggestSaving(false);
    }
  };

  return { aiSuggest, suggestSaving, askAiSuggestions, closeAiSuggestions, saveCheckedSuggestions };
}
