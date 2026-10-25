/**
 * Fill what's missing (Evoni, 2026-10-25): one ask (POST …/fill-missing)
 * drafts every empty field; each draft is then Accepted, Edited or Skipped
 * (or all Accepted at once). Nothing is saved until accepted, and an
 * accepted draft is saved through the page's event PUT (putEvent), one
 * request for Accept all.
 *
 * status: idle | loading | review | error. rows: [{ field, label, value,
 * source, reason, state: 'open'|'saving'|'saved'|'skipped', draft }] where
 * draft is the value as edited.
 */
import { useState } from 'react';
import api from '../../services/api';
import { NUMBER_FIELDS } from '../../lib/eventActions';

const valueFor = (row) => {
  const raw = String(row.draft ?? '').trim();
  return NUMBER_FIELDS.has(row.field) ? Math.round(Number(raw)) : raw;
};
const usable = (row) => {
  const raw = String(row.draft ?? '').trim();
  return raw !== '' && (!NUMBER_FIELDS.has(row.field) || Number.isFinite(Number(raw)));
};

export default function useFillMissing({ showId, eventId, used, putEvent, load, setToast }) {
  const [state, setState] = useState({ status: 'idle', rows: [], error: null });
  const setRows = (fn) => setState((st) => ({ ...st, rows: fn(st.rows) }));
  const patch = (fields, p) => setRows((rows) => rows.map((r) => (fields.includes(r.field) ? { ...r, ...p } : r)));

  const ask = async () => {
    if (used || state.status === 'loading') return;
    setState({ status: 'loading', rows: [], error: null });
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/fill-missing`, {});
      const drafts = Array.isArray(res.data?.data?.drafts) ? res.data.data.drafts : [];
      setState({ status: 'review', error: null, rows: drafts.map((d) => ({ ...d, draft: String(d.value), state: 'open' })) });
    } catch (err) {
      console.error('[EventPackage] fill what\'s missing failed:', err);
      const status = err.response?.status;
      const serverText = err.response?.data?.error;
      const message = (status === 429 || status === 409 || status === 502) && serverText
        ? serverText
        : 'Couldn’t draft the missing fields right now. Try again in a moment.';
      setState({ status: 'error', rows: [], error: message });
    }
  };

  // Accept: the given rows (their drafts as edited) in one PUT.
  const accept = async (fields) => {
    const rows = state.rows.filter((r) => fields.includes(r.field) && r.state === 'open' && usable(r));
    if (used || !rows.length) return;
    const body = Object.fromEntries(rows.map((r) => [r.field, valueFor(r)]));
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
  const close = () => setState({ status: 'idle', rows: [], error: null });

  const open = state.rows.filter((r) => r.state === 'open');
  return {
    ...state, openCount: open.length, saving: state.rows.some((r) => r.state === 'saving'),
    canAcceptAll: open.length > 1 && open.every(usable), usable,
    ask, acceptOne, acceptAll, skip, edit, close,
  };
}
