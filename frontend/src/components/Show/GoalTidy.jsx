/**
 * Tidy my goals (Evoni, 2026-10-25: "This is very confusing I don't know
 * what I am to do"): a one-time review of the Goals tab's goals
 * (lib/goalLadders tidySuggestions). It shows the ladders the goals already
 * form, then each proposed change — merge a near-duplicate (archive one),
 * move a story-conditional goal to passive, keep one primary — with Accept
 * and Skip. Nothing changes until a change is accepted, and then only
 * through the goal update route (PUT .../goals/:goalId; archiving is status
 * 'abandoned', never a delete). Skips are remembered in this browser only
 * (localStorage, a per-viewer convenience), so the review does not come
 * back for what was skipped. Styled by GoalTidy.css with the page's --sp-*
 * colours.
 */
import { useMemo, useState } from 'react';
import { Check, X, Wand2 } from 'lucide-react';
import { tidySuggestions, goalView, targetText, metricLabel } from '../../lib/goalLadders';
import './GoalTidy.css';

const storeKey = (showId) => `goal-tidy-skipped:${showId}`;

function readSkipped(showId) {
  try {
    const raw = window.localStorage.getItem(storeKey(showId));
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch (err) {
    console.error('[GoalTidy] skipped list unreadable:', err);
    return new Set();
  }
}
function writeSkipped(showId, set) {
  try { window.localStorage.setItem(storeKey(showId), JSON.stringify([...set])); } catch (err) {
    console.error('[GoalTidy] skipped list not saved:', err);
  }
}

/** The suggestions not skipped, and the panel's open state. */
export function useTidy({ showId, goals }) {
  const [skipped, setSkipped] = useState(() => readSkipped(showId));
  const [open, setOpen] = useState(false);
  const all = useMemo(() => tidySuggestions(goals), [goals]);
  const items = all.filter((s) => !skipped.has(s.key));
  const skip = (key) => setSkipped((prev) => {
    const next = new Set(prev); next.add(key); writeSkipped(showId, next); return next;
  });
  return { items, open, show: () => setOpen(true), hide: () => setOpen(false), skip };
}

export default function GoalTidy({ tidy, api, showId, goals, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState([]);
  const view = goalView(goals);
  const ladders = [view.primary, ...view.ladders, ...view.background].filter(Boolean);

  const accept = async (item) => {
    setBusy(item.key); setError(null);
    try {
      for (const c of item.changes) await api.put(`/api/v1/world/${showId}/goals/${c.goal_id}`, c.body);
      setDone((d) => [...d, item.title]);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error('[GoalTidy] accept failed:', err);
      setError(err?.response?.data?.error || err?.message || 'The change was not saved.');
    }
    setBusy(null);
  };

  return (
    <section className="szn-card gt" data-testid="cg-tidy" aria-labelledby="gt-heading">
      <header className="gt-head">
        <h3 id="gt-heading" className="szn-card-title"><Wand2 size={16} aria-hidden="true" /> Tidy my goals</h3>
        <button type="button" className="szn-link" onClick={tidy.hide} data-testid="cg-tidy-close">Done</button>
      </header>
      <p className="szn-muted gt-lede">
        Your goals already line up as {ladders.length} ladders: one goal at a time on each, the next one when it is reached.
        {tidy.items.length ? ' These changes would make it cleaner. Nothing changes until you accept one.' : ' Nothing else to tidy.'}
      </p>
      <ul className="gt-ladders" data-testid="cg-tidy-ladders">
        {ladders.map((l) => (
          <li key={l.id}>
            <strong>{metricLabel(l.metric)}:</strong> {l.rungs.map((g) => `${g.title} ${targetText(g)}`).join(' → ')}
          </li>
        ))}
      </ul>
      {error && <p className="szn-error" role="alert">{error}</p>}
      {done.length > 0 && <p className="szn-note" role="status" data-testid="cg-tidy-done">Done: {done.join('; ')}.</p>}
      <ul className="gt-items">
        {tidy.items.map((item) => (
          <li key={item.key} className="gt-item" data-testid={`cg-tidy-item-${item.kind}`}>
            <p className="gt-item-title">{item.title}</p>
            <p className="gt-item-detail">{item.detail}</p>
            <div className="gt-item-actions">
              <button type="button" className="szn-btn" onClick={() => accept(item)} disabled={busy === item.key} aria-label={`Accept: ${item.title}`}>
                <Check size={14} aria-hidden="true" /> {busy === item.key ? 'Saving…' : item.accept}
              </button>
              <button type="button" className="szn-btn is-quiet" onClick={() => tidy.skip(item.key)} disabled={busy === item.key} aria-label={`Skip: ${item.title}`}>
                <X size={14} aria-hidden="true" /> Skip
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
