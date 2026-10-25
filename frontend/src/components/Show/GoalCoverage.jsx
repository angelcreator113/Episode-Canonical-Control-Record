/**
 * Goals line up with the events that move them (Evoni, 2026-10-25: "a, b
 * and c, with pinning, show me first"), on the Season page:
 *
 *   GoalMovers        inside each goal card on the Goals tab: "Moved by: E3
 *                     Paid runway, E11 …" (each pinned one with Unpin), the
 *                     on-track line ("Coins: 600 + 2,400 = 3,000 of 3,000"),
 *                     or "Nothing this season moves this goal"; Find events
 *                     lists the best-fitting events, placed or not, each to
 *                     pin, open, or place.
 *   GoalPartWarnings  one quiet line per part a goal has no event in.
 *   MovesChips        "Moves: <goal>" on a slot card or an event row.
 *
 * The data is lib/goalCoverage's (GET .../season/goal-coverage); a pin or
 * unpin calls onChanged, which reloads it. Styled by GoalCoverage.css with
 * the page's --sp-* colours.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pin, PinOff, TriangleAlert, Target } from 'lucide-react';
import { projectionText, projectionVerdict, partGapText, pinGoal, errorText } from '../../lib/goalCoverage';
import { seasonPageHref } from '../../lib/seasonPage';
import './GoalCoverage.css';

/** "Moves: <goal>" chips; more than `max` folds into "+N". */
export function MovesChips({ goals = [], max = 1, testId }) {
  if (!goals.length) return null;
  const shown = goals.slice(0, max);
  const more = goals.length - shown.length;
  const all = goals.map((g) => g.title).join(', ');
  return (
    <span className="gc-moves" data-testid={testId} title={`Moves: ${all}`} aria-label={`Moves: ${all}`}>
      <Target size={12} aria-hidden="true" />
      <span className="gc-moves-names" aria-hidden="true">Moves: {shown.map((g) => g.title).join(', ')}</span>
      {/* Outside the names, so a cut-off name never hides how many more. */}
      {more > 0 && <span className="gc-moves-more" aria-hidden="true">+{more}</span>}
    </span>
  );
}

/** One quiet line per part where a goal has no event moving it. */
export function GoalPartWarnings({ parts = [] }) {
  const lines = parts.map((p) => ({ p, text: partGapText(p) })).filter((x) => x.text);
  if (!lines.length) return null;
  return (
    <section className="gc-gaps" aria-label="Parts with a goal nothing moves" data-testid="gc-part-gaps">
      <TriangleAlert size={16} aria-hidden="true" className="gc-gaps-icon" />
      <ul>
        {lines.map(({ p, text }) => (
          <li key={p.phase} data-testid={`gc-part-gap-${p.phase}`}>
            <strong>Part {p.phase}{p.title ? ` · ${p.title}` : ''}:</strong> {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FindEvents({ goal, showId, api, onChanged, onClose }) {
  const [state, setState] = useState({ loading: true, events: [], error: null });
  const [busy, setBusy] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/season/goals/${goal.id}/events`);
      setState({ loading: false, events: res.data?.events || [], error: null });
    } catch (err) {
      console.error('[GoalCoverage] find events failed:', err);
      setState({ loading: false, events: [], error: errorText(err) });
    }
  }, [api, showId, goal.id]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (ev) => {
    setBusy(ev.id);
    try {
      await pinGoal(api, showId, ev.id, goal.id, !ev.pinned);
      await load();
      if (onChanged) await onChanged();
    } catch (err) {
      console.error('[GoalCoverage] pin failed:', err);
      setState((s) => ({ ...s, error: errorText(err) }));
    }
    setBusy(null);
  };

  return (
    <div className="gc-find" data-testid={`gc-find-${goal.id}`}>
      <div className="gc-find-head">
        <span className="gc-find-title">Events that could move it</span>
        <button type="button" className="szn-link" onClick={onClose}>Close</button>
      </div>
      {state.loading && <p className="szn-muted" role="status">Finding events…</p>}
      {state.error && <p className="szn-error" role="alert">{state.error}</p>}
      {!state.loading && !state.events.length && !state.error && <p className="szn-muted">No event in the library yet.</p>}
      <ul className="gc-find-list">
        {state.events.map((ev) => (
          <li key={ev.id} className={`gc-find-row${ev.via ? '' : ' is-none'}`} data-testid="gc-find-row">
            <div className="gc-find-main">
              <span className="gc-find-name">{ev.slot ? <span className="gc-code">{ev.slot.code}</span> : null}{ev.name}</span>
              <span className="gc-find-why">{ev.slot ? '' : 'Not placed · '}{ev.reason}</span>
            </div>
            <div className="gc-find-actions">
              <button type="button" className={`szn-btn is-quiet gc-pin${ev.pinned ? ' is-on' : ''}`} disabled={busy === ev.id}
                onClick={() => toggle(ev)} aria-pressed={ev.pinned} data-testid={`gc-pin-${ev.id}`}>
                {ev.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
                {ev.pinned ? 'Unpin' : 'Pin'}
              </button>
              <Link className="szn-link" to={`/shows/${showId}/events/${ev.id}`}>Open</Link>
              {/* Not in a slot: the Events tab pencils it in. */}
              {!ev.slot && <Link className="szn-link" to={seasonPageHref(showId, 'events')} data-testid={`gc-place-${ev.id}`}>Place it</Link>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The goal card's coverage: Moved by (or nothing moves it), the on-track line, and Find events. */
export function GoalMovers({ goal, coverage, showId, api, onChanged }) {
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  if (!coverage) return null;
  const movers = coverage.movers || [];
  const line = projectionText(coverage.projection);
  const verdict = projectionVerdict(coverage.projection);

  const unpin = async (m) => {
    setBusy(m.event_id); setError(null);
    try {
      await pinGoal(api, showId, m.event_id, goal.id, false);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error('[GoalCoverage] unpin failed:', err);
      setError(errorText(err));
    }
    setBusy(null);
  };

  return (
    <div className="gc-goal" data-testid={`gc-goal-${goal.id}`}>
      {movers.length ? (
        <p className="gc-moved" data-testid={`gc-moved-${goal.id}`}>
          <span className="gc-moved-label">Moved by:</span>{' '}
          {movers.map((m, i) => (
            <span key={`${m.slot_id}-${m.event_id}`} className="gc-mover">
              <Link className="gc-mover-link" to={`/shows/${showId}/events/${m.event_id}`} aria-label={`${m.code} ${m.name}${m.pinned ? ' (pinned)' : ''}`}><span className="gc-code">{m.code}</span>{m.name}</Link>
              {m.pinned && (
                <button type="button" className="gc-unpin" onClick={() => unpin(m)} disabled={busy === m.event_id}
                  aria-label={`Unpin ${m.name} from ${goal.title}`} title="Pinned; unpin" data-testid={`gc-unpin-${m.event_id}`}>
                  <Pin size={12} aria-hidden="true" />
                </button>
              )}
              {i < movers.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      ) : (
        <p className="gc-none" data-testid={`gc-none-${goal.id}`}>Nothing this season moves this goal</p>
      )}
      {line && (
        <p className={`gc-proj${coverage.projection.on_track && coverage.projection.counted ? ' is-ok' : ''}`} data-testid={`gc-proj-${goal.id}`}>
          {line}{verdict && <span className="gc-verdict"> · {verdict}</span>}
        </p>
      )}
      {error && <p className="szn-error" role="alert">{error}</p>}
      {!finding && (
        <button type="button" className={`szn-btn ${movers.length ? 'is-quiet gc-find-btn' : 'gc-find-btn'}`} onClick={() => setFinding(true)}
          data-testid={`gc-find-btn-${goal.id}`}>
          <Search size={14} aria-hidden="true" /> Find events
        </button>
      )}
      {finding && <FindEvents goal={goal} showId={showId} api={api} onChanged={onChanged} onClose={() => setFinding(false)} />}
    </div>
  );
}
