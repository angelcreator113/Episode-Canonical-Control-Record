/**
 * Goals and the events that move them (Evoni, 2026-10-25: "a, b and c,
 * with pinning, show me first"): the client side of
 * GET /api/v1/world/:showId/season/goal-coverage (services/seasonGoalCoverage)
 * and the pin routes. The hook reads it; the helpers word it.
 *
 *   useGoalCoverage({ api, showId, eventId, reloadKey })  → { data, error, reload }
 *   pinGoal(api, showId, eventId, goalId, on, { move })    PUT (on) / DELETE (off) …/pin; move=1 moves
 *                        the event from the goal it is already the main event for
 *   projectionText(p)    "Coins: 600 + 2,400 = 3,000 of 3,000"
 *   partGapText(part)    "nothing moves Save coins, Earn brand trust" (at most three names)
 *   slotGoalsMap(data)   { [slot_id]: [goal] } for the slot cards' "Moves:" chips
 */
import { useCallback, useEffect, useState } from 'react';

const n = (v) => Number(v || 0).toLocaleString('en-US');

/** The on-track line: the current value plus what the placed events are expected to add, against the target. */
export function projectionText(p) {
  if (!p) return null;
  if (!p.counted) return `${p.label}: ${n(p.current)} of ${n(p.target)} · no expected reward counted yet`;
  return `${p.label}: ${n(p.current)} + ${n(p.gain)} = ${n(p.projected)} of ${n(p.target)}`;
}

/** The short verdict beside the projection. */
export function projectionVerdict(p) {
  if (!p || !p.counted) return null;
  return p.on_track ? 'On track' : `${n(p.short)} short`;
}

// How many goal names one part's warning line spells out (Evoni,
// 2026-10-25: no "+9 more" noise; the server only names goals being worked
// on of a stat events move, so three is plenty).
const GAP_NAMES = 3;

/**
 * One part's warning, compact: at most three goal names. `covered` (a Set
 * of goal ids, optional) keeps only those, for a coverage read from a
 * server that still named every goal.
 */
export function partGapText(part, covered = null) {
  const gaps = (part?.gaps || []).filter((g) => !covered || covered.has(String(g.goal_id)));
  if (!gaps.length) return null;
  return `nothing moves ${gaps.slice(0, GAP_NAMES).map((g) => g.title).join(', ')}`;
}

/** The goal ids the parts are asked to cover (active rungs of a stat events move); null when the coverage does not say. */
export function coveredGoalIds(data) {
  const goals = data?.goals || [];
  if (!goals.length || !goals.some((g) => 'covered' in g)) return null;
  return new Set(goals.filter((g) => g.covered).map((g) => String(g.id)));
}

/** The goals each placed slot's event moves, by slot id. */
export function slotGoalsMap(data) {
  const out = {};
  for (const s of data?.slots || []) out[s.slot_id] = s.goals || [];
  return out;
}

export function pinGoal(api, showId, eventId, goalId, on, { move = false } = {}) {
  const path = `/api/v1/world/${showId}/season/events/${eventId}/goals/${goalId}/pin`;
  return on ? api.put(move ? `${path}?move=1` : path) : api.delete(path);
}

export const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

/**
 * Reads the coverage; reloadKey (e.g. the roadmap) reloads it when the
 * slots change. A failed read leaves data null and says why in error.
 */
export function useGoalCoverage({ api, showId, eventId = null, reloadKey = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!api || !showId) return;
    try {
      const res = await api.get(`/api/v1/world/${showId}/season/goal-coverage${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ''}`);
      setData(res.data || null);
      setError(null);
    } catch (err) {
      console.error('[goalCoverage] load failed:', err);
      setError(errorText(err));
    }
  }, [api, showId, eventId]);
  useEffect(() => { reload(); }, [reload, reloadKey]);
  return { data, error, reload };
}
