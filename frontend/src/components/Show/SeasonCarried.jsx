/**
 * "What's carried into Season N+1?" under a past season's threads on the
 * Story tab (Evoni, 2026-10-26, Season page round 3 AI buttons). A button
 * she presses: one AI call (POST .../season/ai/carried?season=N,
 * services/seasonAiHelpers) reads the season's threads that are not
 * closed, its twists still planned or planted and the secrets still kept,
 * and suggests for each: continue, resolve or drop, with a reason, and the
 * next season's episode it fits. She can change each choice, and ticks the
 * ones to apply; nothing changes until "Apply the ticked ones":
 *
 *   continue / resolve  a thread stays open and is linked to that episode
 *                       (a story purpose); a twist is carried there as a new
 *                       planned twist; a secret is hinted (continue) or
 *                       revealed (resolve) there
 *   drop                a thread is closed (the Close path); a twist is
 *                       marked dropped; a secret is left as it is
 *
 * Nothing is ever deleted. Props: api, showId, season (the past season's
 * number), onApplied (reload the threads).
 */
import { useState } from 'react';
import { Sparkles, Check, AlertTriangle } from 'lucide-react';
import { aiErrorText, seasonQuery } from '../../lib/seasonAi';
import './SeasonCarried.css';

const TYPE_LABEL = { thread: 'Thread', twist: 'Twist', secret: 'Secret' };
const CHOICES = [['continue', 'Continue'], ['resolve', 'Resolve'], ['drop', 'Drop']];

function outcome(row, nextNumber) {
  if (row.decision === 'drop') {
    return { thread: 'Closes the thread (kept, not deleted).', twist: 'Marks the twist dropped (kept, not deleted).', secret: 'Leaves the secret as it is.' }[row.type];
  }
  if (!row.slot_number) return row.type === 'thread' ? 'Stays open.' : `Needs an open episode in Season ${nextNumber}.`;
  const at = `S${nextNumber} · E${row.slot_number}`;
  if (row.type === 'thread') return `Stays open, linked to ${at}.`;
  if (row.type === 'twist') return `Carried into ${at} as a planned twist.`;
  return `${row.decision === 'resolve' ? 'Revealed' : 'Hinted'} in ${at}.`;
}

export default function SeasonCarried({ api, showId, season, onApplied = null }) {
  const [state, setState] = useState({ busy: false, data: null, error: null });
  const [rows, setRows] = useState([]);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState(null);
  const base = `/api/v1/world/${showId}/season/ai/carried`;
  const nextNumber = Number(state.data?.next_season?.season_number) || Number(season) + 1;

  const ask = async () => {
    setState({ busy: true, data: null, error: null });
    setResults(null);
    try {
      const res = await api.post(`${base}${seasonQuery(season)}`);
      setState({ busy: false, data: res.data, error: null });
      // The AI's slot is kept for continue/resolve; ticked by Evoni only.
      setRows((res.data?.items || []).map((i) => ({ ...i, picked: i.slot_id, picked_number: i.slot_number, tick: false })));
    } catch (err) {
      console.error('[SeasonCarried] carried read failed:', err);
      setState({ busy: false, data: null, error: aiErrorText(err, 'What the season carries could not be read. Try again.') });
    }
  };
  const change = (ref, patch) => setRows((list) => list.map((r) => {
    if (r.ref !== ref) return r;
    const next = { ...r, ...patch };
    // Back from drop: the episode the AI picked again.
    next.slot_id = next.decision === 'drop' ? null : r.picked;
    next.slot_number = next.decision === 'drop' ? null : r.picked_number;
    return next;
  }));
  const ticked = rows.filter((r) => r.tick);
  const apply = async () => {
    setApplying(true);
    try {
      const decisions = ticked.map((r) => ({ type: r.type, id: r.id, decision: r.decision, slot_id: r.slot_id }));
      const res = await api.post(`${base}/apply${seasonQuery(season)}`, { decisions });
      setResults(res.data?.results || []);
      setRows((list) => list.filter((r) => !r.tick));
      if (onApplied) onApplied();
    } catch (err) {
      console.error('[SeasonCarried] apply failed:', err);
      setResults([{ id: 'error', ok: false, text: aiErrorText(err, 'Nothing could be applied. Try again.') }]);
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="szn-card scar" aria-labelledby="scar-title" data-testid="szn-carried">
      <header className="scar-head">
        <h2 id="scar-title" className="scar-heading">What&apos;s carried into Season {nextNumber}?</h2>
        <button type="button" className="scar-btn" onClick={ask} disabled={state.busy || applying} data-testid="szn-carried-ask">
          <Sparkles size={14} aria-hidden="true" /> {state.busy ? 'Reading the season…' : state.data ? 'Read again' : 'Suggest what to carry'}
        </button>
      </header>
      {!state.data && !state.error && !state.busy && (
        <p className="scar-muted">Reads this season&apos;s open threads, open twists and kept secrets, and suggests for each: continue, resolve or drop. Tick the ones to apply; nothing changes until you do, and nothing is deleted.</p>
      )}
      {state.error && <p className="scar-error" role="alert" data-testid="szn-carried-error">{state.error}</p>}
      {state.data && !state.data.next_season?.arc_id && (
        <p className="scar-warn" data-testid="szn-carried-no-next"><AlertTriangle size={14} aria-hidden="true" /> Season {nextNumber} is not set up yet: threads can stay open, but twists and secrets need its episodes first.</p>
      )}
      {state.data && rows.length === 0 && !results && <p className="scar-muted" data-testid="szn-carried-empty">Nothing is left open in this season.</p>}
      {rows.length > 0 && (
        <ul className="scar-list">
          {rows.map((r) => (
            <li key={r.ref} className={`scar-row is-${r.decision}${r.tick ? ' is-ticked' : ''}`} data-testid={`szn-carried-row-${r.type}`}>
              <label className="scar-tick">
                <input type="checkbox" checked={r.tick} onChange={(e) => change(r.ref, { tick: e.target.checked })} aria-label={`Apply: ${r.title}`} />
              </label>
              <div className="scar-body">
                <p className="scar-type">{TYPE_LABEL[r.type]} · {r.status}</p>
                <p className="scar-title">{r.title}</p>
                {r.reason && <p className="scar-reason">{r.reason}</p>}
                <div className="scar-choice" role="radiogroup" aria-label={`What to do with ${r.title}`}>
                  {CHOICES.map(([key, label]) => (
                    <button key={key} type="button" role="radio" aria-checked={r.decision === key}
                      className={`scar-seg${r.decision === key ? ' is-on' : ''}`} onClick={() => change(r.ref, { decision: key })}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="scar-outcome">{outcome(r, nextNumber)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="scar-actions">
          <button type="button" className="scar-btn" onClick={apply} disabled={!ticked.length || applying} data-testid="szn-carried-apply">
            <Check size={14} aria-hidden="true" /> {applying ? 'Applying…' : `Apply the ticked ones (${ticked.length})`}
          </button>
        </div>
      )}
      {results && (
        <ul className="scar-results" role="status" data-testid="szn-carried-results">
          {results.map((r, i) => <li key={`${r.id}-${i}`} className={r.ok ? 'is-ok' : 'is-bad'}>{r.text}</li>)}
        </ul>
      )}
    </section>
  );
}
