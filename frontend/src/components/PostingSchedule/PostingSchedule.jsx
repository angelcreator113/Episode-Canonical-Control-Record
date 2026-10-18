/**
 * Posting schedule (Evoni, 2026-10-18: "when it comes to me it comes with a
 * schedule that makes sense for that character ... and i just approve"):
 * the days, time windows and posts a week a Feed profile posts on, in her own
 * time. Suggested from who they are until she saves her own; Review's
 * suggested release times and the ambient drafts follow it
 * (GET/PUT /api/v1/social-profiles/:id/posting-schedule, .../suggest;
 * services/postingSchedule).
 */
import { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, X, Sparkles } from 'lucide-react';
import api from '../../services/api';
import './PostingSchedule.css';

export const DAYS = Object.freeze([
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
]);
const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const blank = { days: ['mon', 'wed', 'fri'], windows: [{ start: '12:00', end: '14:00' }], per_week: 3 };
const formOf = (s) => (s ? { days: [...s.days], windows: s.windows.map((w) => ({ ...w })), per_week: s.per_week } : null);

export default function PostingSchedule({ profileId }) {
  const [state, setState] = useState({ loading: true, saved: null, suggestion: null });
  const [form, setForm] = useState(null);
  const [why, setWhy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const base = `/api/v1/social-profiles/${profileId}/posting-schedule`;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(base);
      setState({ loading: false, saved: data.schedule || null, suggestion: data.suggestion || null });
      setForm(formOf(data.schedule) || formOf(data.suggestion?.schedule) || blank);
      setWhy(data.schedule ? null : data.suggestion?.why || null);
    } catch (err) {
      console.error('[PostingSchedule] the schedule could not be read:', err);
      setState({ loading: false, saved: null, suggestion: null });
      setForm(blank);
      setError(errorText(err, 'The schedule could not be loaded.'));
    }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const toggleDay = (d) => setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));
  const setWindow = (i, key, value) => setForm((f) => ({ ...f, windows: f.windows.map((w, j) => (j === i ? { ...w, [key]: value } : w)) }));

  const suggest = async () => {
    setBusy(true); setError(null); setNote(null);
    try {
      const { data } = await api.post(`${base}/suggest`);
      setForm(formOf(data.schedule));
      setWhy(data.why || null);
    } catch (err) {
      console.error('[PostingSchedule] the suggestion failed:', err);
      setError(errorText(err, 'No suggestion right now.'));
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setError(null); setNote(null);
    try {
      const { data } = await api.put(base, { schedule: { ...form, tz_offset: new Date().getTimezoneOffset() } });
      setState((s) => ({ ...s, saved: data.schedule }));
      setWhy(null);
      setNote('Saved. Review suggests their release times inside this schedule.');
    } catch (err) {
      console.error('[PostingSchedule] the schedule could not be saved:', err);
      setError(errorText(err, 'The schedule did not save.'));
    } finally { setBusy(false); }
  };

  if (state.loading || !form) return <div className="ch-card ps"><p className="ps-muted">Loading the schedule…</p></div>;

  return (
    <div className="ch-card ps" data-testid="posting-schedule">
      <h3 className="ps-title"><CalendarClock size={16} aria-hidden /> Posting schedule</h3>
      {!state.saved && (
        <p className="ps-muted" data-testid="posting-schedule-suggested">Suggested from who they are until you save one. Review's release times follow it once saved.</p>
      )}
      {why && <p className="ps-why">{why}</p>}

      <div className="ps-days" role="group" aria-label="Days they post">
        {DAYS.map(([d, label]) => (
          <button key={d} type="button" className={`ps-day${form.days.includes(d) ? ' is-on' : ''}`} aria-pressed={form.days.includes(d)} onClick={() => toggleDay(d)}>{label}</button>
        ))}
      </div>

      <div className="ps-windows">
        {form.windows.map((w, i) => (
          <div key={i} className="ps-window">
            <label>From <input type="time" value={w.start} onChange={(e) => setWindow(i, 'start', e.target.value)} aria-label={`Window ${i + 1} start`} /></label>
            <label>to <input type="time" value={w.end} onChange={(e) => setWindow(i, 'end', e.target.value)} aria-label={`Window ${i + 1} end`} /></label>
            {form.windows.length > 1 && (
              <button type="button" className="ps-icon" aria-label={`Remove window ${i + 1}`} onClick={() => setForm((f) => ({ ...f, windows: f.windows.filter((_, j) => j !== i) }))}><X size={14} aria-hidden /></button>
            )}
          </div>
        ))}
        {form.windows.length < 4 && (
          <button type="button" className="ps-link" onClick={() => setForm((f) => ({ ...f, windows: [...f.windows, { start: '18:00', end: '20:00' }] }))}><Plus size={13} aria-hidden /> Add a time</button>
        )}
      </div>

      <label className="ps-week">Posts a week
        <input type="number" min={1} max={28} value={form.per_week} onChange={(e) => setForm((f) => ({ ...f, per_week: Number(e.target.value) }))} />
      </label>

      <div className="ps-actions">
        <button type="button" className="ps-btn is-quiet" disabled={busy} onClick={suggest}><Sparkles size={14} aria-hidden /> Suggest from who they are</button>
        <button type="button" className="ps-btn" disabled={busy || !form.days.length} onClick={save}>Save schedule</button>
      </div>
      {note && <p className="ps-note" role="status">{note}</p>}
      {error && <p className="ps-error" role="alert">{error}</p>}
    </div>
  );
}
