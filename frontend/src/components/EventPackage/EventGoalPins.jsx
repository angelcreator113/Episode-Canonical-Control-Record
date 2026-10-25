/**
 * The goals this event moves, in the Event Package's header (Evoni,
 * 2026-10-25: goals line up with the events that move them, "with
 * pinning"): "Moves: Save coins, Earn brand trust" — each pinned one with
 * an unpin — and "Pin to a goal", which pins one of the season's active
 * goals to this event (a pin always counts as moving it).
 *
 * Reads GET .../season/goal-coverage?event_id= (lib/goalCoverage); pins
 * through PUT / DELETE .../season/events/:eventId/goals/:goalId/pin, which
 * change only canon_consequences.pinned_goal_ids and not the event's save
 * version. Hidden when the show has no active season or no goals. Never
 * blocks the page.
 */
import { useState } from 'react';
import { Target, Pin, X } from 'lucide-react';
import { useGoalCoverage, pinGoal, errorText } from '../../lib/goalCoverage';
import './EventGoalPins.css';

export default function EventGoalPins({ api, showId, eventId }) {
  const { data, reload } = useGoalCoverage({ api, showId, eventId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ev = data?.event;
  if (!ev || !ev.goals?.length) return null;
  const unpinned = ev.goals.filter((g) => !g.pinned);

  const change = async (goalId, on) => {
    setBusy(true); setError(null);
    try {
      await pinGoal(api, showId, eventId, goalId, on);
      await reload();
    } catch (err) {
      console.error('[EventGoalPins] pin change failed:', err);
      setError(errorText(err));
    }
    setBusy(false);
  };

  return (
    <div className="egp" data-testid="event-goal-pins" role="group" aria-label="Goals this event moves">
      <span className="egp-label"><Target size={14} aria-hidden="true" /> Moves:</span>
      {ev.moves.length === 0 && <span className="egp-none" data-testid="egp-none">no goal yet</span>}
      <ul className="egp-chips">
        {ev.moves.map((g) => (
          <li key={g.goal_id} className={`egp-chip${g.pinned ? ' is-pinned' : ''}`} data-testid={`egp-chip-${g.goal_id}`}>
            {g.pinned && <Pin size={12} aria-hidden="true" />}
            <span>{g.title}</span>
            {g.pinned && (
              <button type="button" className="egp-unpin" onClick={() => change(g.goal_id, false)} disabled={busy}
                aria-label={`Unpin ${g.title}`} data-testid={`egp-unpin-${g.goal_id}`}>
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {unpinned.length > 0 && (
        <select className="egp-select" value="" disabled={busy} aria-label="Pin this event to a goal"
          onChange={(e) => { if (e.target.value) change(e.target.value, true); }} data-testid="egp-pin-select">
          <option value="">Pin to a goal…</option>
          {unpinned.map((g) => <option key={g.goal_id} value={g.goal_id}>{g.title}</option>)}
        </select>
      )}
      {error && <p className="egp-error" role="alert">{error}</p>}
    </div>
  );
}
