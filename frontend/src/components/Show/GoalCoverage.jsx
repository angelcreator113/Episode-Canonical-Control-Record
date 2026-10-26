/**
 * Goals line up with the events that move them (Evoni, 2026-10-25: "a, b
 * and c, with pinning, show me first"; then "How should I attach them to
 * the right event at the right time? And should some episodes have
 * multiple"), on the Season page:
 *
 *   GoalMovers        inside the card of a goal being worked on, for a stat
 *                     events move: "Moved by: E3 Paid runway" — only the
 *                     event(s) picked for it (pinned) — "Also helps: E3, E9
 *                     +4" (folded), and Pick its event: the 2–3 best events
 *                     in its episode range, one tap pins one as the event
 *                     this goal is for. An event already picked for another
 *                     goal asks to move it (one main goal per episode).
 *                     "See every event" opens the full Find events list.
 *   GoalAdvice        for a performance stat (followers, influence,
 *                     portfolio): what moves it and where that happens.
 *   GoalPartWarnings  one quiet line per part a goal being worked on has no
 *                     event in, at most three names.
 *   MovesChips        "Moves: <goal>" on a slot card or an event row.
 *
 * The data is lib/goalCoverage's (GET .../season/goal-coverage); a pin or
 * unpin calls onChanged, which reloads it. Styled by GoalCoverage.css with
 * the page's --sp-* colours.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pin, PinOff, TriangleAlert, Target, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { partGapText, pinGoal, errorText } from '../../lib/goalCoverage';
import { PERFORMANCE_ADVICE } from '../../lib/goalLadders';
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

/** One quiet line per part where a goal being worked on has no event moving it. */
export function GoalPartWarnings({ parts = [], covered = null }) {
  const lines = parts.map((p) => ({ p, text: partGapText(p, covered) })).filter((x) => x.text);
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

/**
 * Pick its event: the best two or three events for the goal (placed in its
 * episode range first, then not placed yet), each one tap to pick. One
 * already picked for another goal says so and moves it on a second tap.
 */
function PickEvent({ goal, showId, api, onChanged, onClose }) {
  const [state, setState] = useState({ loading: true, pick: [], error: null });
  const [busy, setBusy] = useState(null);
  const [asking, setAsking] = useState(null); // { id, title } after a refusal
  const [all, setAll] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/season/goals/${goal.id}/events`);
      const events = res.data?.events || [];
      // An older server sends no pick: the first movers of its list.
      const pick = res.data?.pick || events.filter((e) => e.via).slice(0, 3);
      setState({ loading: false, pick, error: null });
    } catch (err) {
      console.error('[GoalCoverage] pick its event failed:', err);
      setState({ loading: false, pick: [], error: errorText(err) });
    }
  }, [api, showId, goal.id]);
  useEffect(() => { load(); }, [load]);

  const choose = async (ev, move = false) => {
    setBusy(ev.id); setAsking(null);
    try {
      await pinGoal(api, showId, ev.id, goal.id, !ev.pinned, { move });
      await load();
      if (onChanged) await onChanged();
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.code === 'MAIN_GOAL_TAKEN') {
        console.warn('[GoalCoverage] pick asks to move:', data.error);
        setAsking({ id: ev.id, title: data.main_goal?.title || 'another goal' });
      } else {
        console.error('[GoalCoverage] pick failed:', err);
        setState((s) => ({ ...s, error: errorText(err) }));
      }
    }
    setBusy(null);
  };

  return (
    <div className="gc-find gc-pick" data-testid={`gc-pick-${goal.id}`}>
      <div className="gc-find-head">
        <span className="gc-find-title">The event this goal is for</span>
        <button type="button" className="szn-link" onClick={onClose}>Close</button>
      </div>
      {state.loading && <p className="szn-muted" role="status">Finding the best events…</p>}
      {state.error && <p className="szn-error" role="alert">{state.error}</p>}
      {!state.loading && !state.pick.length && !state.error && (
        <p className="szn-muted" data-testid={`gc-pick-empty-${goal.id}`}>No placed event moves it yet. See every event, or add one in Events.</p>
      )}
      <ul className="gc-find-list">
        {state.pick.map((ev) => {
          const taken = ev.main_goal && !ev.pinned;
          const ask = asking?.id === ev.id || null;
          return (
            <li key={ev.id} className="gc-find-row" data-testid="gc-pick-row">
              <div className="gc-find-main">
                <span className="gc-find-name">{ev.slot ? <span className="gc-code">{ev.slot.code}</span> : null}{ev.name}</span>
                <span className="gc-find-why">{ev.slot ? '' : 'Not placed · '}{ev.reason}</span>
                {(taken || ask) && (
                  <span className="gc-taken" data-testid={`gc-taken-${ev.id}`}>Already the event for {(ask && asking.title) || ev.main_goal.title}</span>
                )}
              </div>
              <div className="gc-find-actions">
                <button type="button" className={`szn-btn ${ev.pinned ? 'is-quiet gc-pin is-on' : 'gc-pin'}`} disabled={busy === ev.id}
                  onClick={() => choose(ev, Boolean(taken || ask))} aria-pressed={ev.pinned} data-testid={`gc-pick-${goal.id}-${ev.id}`}>
                  {ev.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
                  {ev.pinned ? 'Unpick' : taken || ask ? 'Move it here' : 'Pick'}
                </button>
                {!ev.slot && <Link className="szn-link" to={seasonPageHref(showId, 'events')}>Place it</Link>}
              </div>
            </li>
          );
        })}
      </ul>
      {!all && (
        <button type="button" className="szn-link gc-all" onClick={() => setAll(true)} data-testid={`gc-find-btn-${goal.id}`}>
          <Search size={14} aria-hidden="true" /> See every event
        </button>
      )}
      {all && <FindEvents goal={goal} showId={showId} api={api} onChanged={async () => { await load(); if (onChanged) await onChanged(); }} onClose={() => setAll(false)} />}
    </div>
  );
}

/** "E3, E9 +4", folded; open, each one is a link to its event. */
function AlsoHelps({ goal, list, showId }) {
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const shown = list.slice(0, 2).map((m) => m.code).join(', ');
  const more = list.length - Math.min(2, list.length);
  return (
    <div className="gc-also" data-testid={`gc-also-${goal.id}`}>
      <button type="button" className="gc-also-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        aria-label={`Also helps: ${list.map((m) => `${m.code} ${m.name}`).join(', ')}`}>
        <span className="gc-moved-label">Also helps:</span> {shown}{more > 0 ? ` +${more}` : ''}
        {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
      {open && (
        <ul className="gc-also-list">
          {list.map((m) => (
            <li key={`${m.slot_id}-${m.event_id}`}>
              <Link className="gc-mover-link" to={`/shows/${showId}/events/${m.event_id}`}><span className="gc-code">{m.code}</span>{m.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The goal card's events, for a goal of a stat events move: Moved by (its
 * picked events only), Also helps, and Pick its event.
 */
export function GoalMovers({ goal, coverage, showId, api, onChanged }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  if (!coverage) return null;
  const movers = coverage.movers || [];
  // An older coverage read has no main_events: the pinned movers are the main ones.
  const main = coverage.main_events || movers.filter((m) => m.pinned);
  const also = coverage.also_helps || movers.filter((m) => !m.pinned);

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
      {main.length ? (
        <p className="gc-moved" data-testid={`gc-moved-${goal.id}`}>
          <span className="gc-moved-label">Moved by:</span>{' '}
          {main.map((m, i) => (
            <span key={`${m.slot_id}-${m.event_id}`} className="gc-mover">
              <Link className="gc-mover-link" to={`/shows/${showId}/events/${m.event_id}`} aria-label={`${m.code} ${m.name} (picked)`}><span className="gc-code">{m.code}</span>{m.name}</Link>
              <button type="button" className="gc-unpin" onClick={() => unpin(m)} disabled={busy === m.event_id}
                aria-label={`Unpin ${m.name} from ${goal.title}`} title="Picked for this goal; unpick" data-testid={`gc-unpin-${m.event_id}`}>
                <Pin size={12} aria-hidden="true" />
              </button>
              {i < main.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      ) : (
        <p className="gc-none" data-testid={`gc-none-${goal.id}`}>No event picked for it yet</p>
      )}
      <AlsoHelps goal={goal} list={also} showId={showId} />
      {error && <p className="szn-error" role="alert">{error}</p>}
      {!picking && (
        <button type="button" className={`szn-btn ${main.length ? 'is-quiet gc-find-btn' : 'gc-find-btn'}`} onClick={() => setPicking(true)}
          data-testid={`gc-pick-btn-${goal.id}`}>
          <Pin size={14} aria-hidden="true" /> {main.length ? 'Change its event' : 'Pick its event'}
        </button>
      )}
      {picking && <PickEvent goal={goal} showId={showId} api={api} onChanged={onChanged} onClose={() => setPicking(false)} />}
    </div>
  );
}

/** A performance stat: what moves it and where that happens, in place of Find events. */
export function GoalAdvice({ goal, showId }) {
  const text = PERFORMANCE_ADVICE[goal.target_metric] || 'Moved by Pulse posts, deliverables and episode results';
  return (
    <div className="gc-goal gc-advice" data-testid={`gc-advice-${goal.id}`}>
      <p className="gc-advice-text">{text}.</p>
      <Link className="szn-link gc-advice-link" to={`/shows/${encodeURIComponent(showId)}/world?tab=release`}>
        Open Release <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
