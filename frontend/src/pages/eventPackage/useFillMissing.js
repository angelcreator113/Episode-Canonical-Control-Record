/**
 * Fill what's missing (Evoni, 2026-10-25): one ask (POST …/fill-missing)
 * drafts every empty field; each draft is then Accepted, Edited or Skipped
 * (or all Accepted at once). Nothing is saved until accepted, and an
 * accepted draft is saved through the page's event PUT (putEvent), one
 * request for Accept all.
 *
 * It is the page's one AI entry point (Evoni, 2026-10-25: "Merge the
 * Suggest with AI button into Fill what's missing"), so it also carries
 * what Suggest with AI offered:
 *   - the page's own suggestions ("From this event's facts"): a Basics
 *     field in the suggested state, and the organizer the event was started
 *     from, each listed beside the AI drafts when the AI did not draft that
 *     field, accepted or skipped the same way;
 *   - fresh ideas when nothing is empty (`ideas`): the ask sends
 *     { mode: 'ideas' } and the server drafts alternatives for the six
 *     basics, each with the `current` value it would replace.
 *
 * status: idle | loading | review | error. rows: [{ field, label, value,
 * source: 'ai'|'facts'|'rate_card', reason, current?, fixed?, display?,
 * update?, state: 'open'|'saving'|'saved'|'skipped', draft }] where draft
 * is the value as edited. A fixed row (the organizer) is not edited; its
 * `update.body` is what the PUT carries.
 */
import { useState } from 'react';
import api from '../../services/api';
import { NUMBER_FIELDS } from '../../lib/eventActions';
import { BASICS_FIELDS, BASICS_PAGE_ORDER } from '../../lib/eventPackageFields';
import { hasValueState } from '../../utils/eventBasics';
import { buildCreatorOrganizerUpdate } from '../../utils/eventOrganizer';

// The fields the server drafts that are not Basics rows (the invitation's
// theme and mood, and the stakes texts), read from the event itself.
const OTHER_AI_FIELDS = ['theme', 'mood', 'narrative_stakes', 'fail_consequence', 'success_unlock', 'career_milestone'];

const valueFor = (row) => {
  const raw = String(row.draft ?? '').trim();
  return NUMBER_FIELDS.has(row.field) ? Math.round(Number(raw)) : raw;
};
const usable = (row) => {
  if (row.fixed) return true;
  const raw = String(row.draft ?? '').trim();
  return raw !== '' && (!NUMBER_FIELDS.has(row.field) || Number.isFinite(Number(raw)));
};

/** Whether every field the AI can draft is set, so the ask is for fresh ideas instead. */
export function nothingMissing(event, basics) {
  if (!event || !basics) return false;
  return BASICS_PAGE_ORDER.every((key) => hasValueState(basics[key]?.state))
    && OTHER_AI_FIELDS.every((f) => String(event[f] ?? '').trim() !== '');
}

/** The page's own suggestions, as rows, for the fields not in `covered`. */
function factsRows({ basics, event, startedFrom, organizer }, covered) {
  const rows = BASICS_PAGE_ORDER
    .filter((key) => basics?.[key]?.state === 'suggested' && basics[key].suggestion && !covered.has(BASICS_FIELDS[key].column))
    .map((key) => ({
      field: BASICS_FIELDS[key].column, label: BASICS_FIELDS[key].label, value: String(basics[key].suggestion.value),
      source: 'facts', reason: basics[key].suggestion.basis || '',
    }));
  if (startedFrom?.suggestOrganizer && organizer && !organizer.hasOrganizer) {
    const update = buildCreatorOrganizerUpdate(event, startedFrom.profile);
    if (!update.unchanged) {
      rows.push({
        field: 'organizer', label: 'Organizer', value: startedFrom.name, display: `${startedFrom.name} (creator)`,
        fixed: true, update, source: 'facts', reason: 'You started this event from their Pulse profile',
      });
    }
  }
  return rows;
}

export default function useFillMissing({ showId, eventId, event = null, basics = null, used, startedFrom = null, organizer = null, putEvent, load, setToast }) {
  const [state, setState] = useState({ status: 'idle', rows: [], error: null, mode: 'missing' });
  const setRows = (fn) => setState((st) => ({ ...st, rows: fn(st.rows) }));
  const patch = (fields, p) => setRows((rows) => rows.map((r) => (fields.includes(r.field) ? { ...r, ...p } : r)));
  const ideas = nothingMissing(event, basics);

  const ask = async () => {
    if (used || state.status === 'loading') return;
    const mode = ideas ? 'ideas' : 'missing';
    setState({ status: 'loading', rows: [], error: null, mode });
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/fill-missing`, ideas ? { mode: 'ideas' } : {});
      const drafts = Array.isArray(res.data?.data?.drafts) ? res.data.data.drafts : [];
      const ai = drafts.filter((d) => d.source !== 'rate_card');
      const fees = drafts.filter((d) => d.source === 'rate_card');
      const facts = factsRows({ basics, event, startedFrom, organizer }, new Set(ai.map((d) => d.field)));
      const rows = [...ai, ...facts, ...fees].map((d) => ({ ...d, draft: String(d.value), state: 'open' }));
      setState({ status: 'review', error: null, mode, rows });
    } catch (err) {
      console.error('[EventPackage] fill what\'s missing failed:', err);
      const status = err.response?.status;
      const serverText = err.response?.data?.error;
      const message = (status === 429 || status === 409 || status === 502) && serverText
        ? serverText
        : 'Couldn’t draft the missing fields right now. Try again in a moment.';
      setState({ status: 'error', rows: [], error: message, mode });
    }
  };

  // Accept: the given rows (their drafts as edited) in one PUT.
  const accept = async (fields) => {
    const rows = state.rows.filter((r) => fields.includes(r.field) && r.state === 'open' && usable(r));
    if (used || !rows.length) return;
    const body = {};
    for (const r of rows) {
      if (r.update) Object.assign(body, r.update.body);
      else body[r.field] = valueFor(r);
    }
    patch(rows.map((r) => r.field), { state: 'saving' });
    try {
      await putEvent(body);
      patch(rows.map((r) => r.field), { state: 'saved' });
      setToast(rows.length === 1 ? `Saved ${rows[0].label.toLowerCase()}` : `Saved ${rows.length} fields`);
      await load();
    } catch (err) {
      console.error('[EventPackage] saving drafts failed:', err);
      patch(rows.map((r) => r.field), { state: 'open' });
      setToast(err.response?.data?.error || err.message || 'Failed to save');
    }
  };
  const acceptOne = (field) => accept([field]);
  const acceptAll = () => accept(state.rows.filter((r) => r.state === 'open').map((r) => r.field));
  const skip = (field) => patch([field], { state: 'skipped' });
  const edit = (field, draft) => patch([field], { draft });
  const close = () => setState({ status: 'idle', rows: [], error: null, mode: 'missing' });

  const open = state.rows.filter((r) => r.state === 'open');
  return {
    ...state, ideas, openCount: open.length, saving: state.rows.some((r) => r.state === 'saving'),
    canAcceptAll: open.length > 1 && open.every(usable), usable,
    ask, acceptOne, acceptAll, skip, edit, close,
  };
}
