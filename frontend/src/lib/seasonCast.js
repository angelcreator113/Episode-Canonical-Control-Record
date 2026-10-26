/**
 * Who's in this season (the Season page's Cast tab; Evoni, 2026-10-25:
 * "What else can we improve on the Season page?" … "I want them all";
 * 2026-10-26, round 3): the client side of GET
 * /api/v1/world/:showId/season/cast (services/seasonCast). The hook reads
 * it; the helpers word it plainly.
 *
 *   useSeasonCast({ api, showId, season, reloadKey })  → { data, error, reload }
 *   appearanceLine(person)   "Truthville: E2, E11"
 *   longestGap(person, last) the longest run of the season's episodes they are not in, between two they are
 *   gapText(gap)             "Not seen E3 – E10 (8 episodes)"
 *   changeText(change)       "Ana and Ben: friends to rivals"
 *   personHref(person)       the person page (/character/:id) when they have a registry character, else null
 */
import { useCallback, useEffect, useState } from 'react';

// A gap shorter than this is ordinary (two episodes off): only longer ones are named.
export const GAP_MIN = 3;

const words = (v) => String(v || '').replace(/_/g, ' ');

export const appearanceLine = (p) => `${p.name}: ${(p.slots || []).map((n) => `E${n}`).join(', ')}`;

/**
 * The longest stretch between two of their episodes they are not in:
 * { from, to, length } or null when it is shorter than GAP_MIN (or they are
 * in one episode only: there is no "between").
 */
export function longestGap(person) {
  const nums = [...(person?.slots || [])].sort((a, b) => a - b);
  let best = null;
  for (let i = 1; i < nums.length; i += 1) {
    const length = nums[i] - nums[i - 1] - 1;
    if (length >= GAP_MIN && (!best || length > best.length)) best = { from: nums[i - 1] + 1, to: nums[i] - 1, length };
  }
  return best;
}

export const gapText = (gap) => (gap ? `Not seen E${gap.from} – E${gap.to} (${gap.length} episodes)` : null);

/** One relationship change in words. */
export function changeText(c) {
  const who = `${c.a?.name || '?'} and ${c.b?.name || '?'}`;
  if (c.stage_before && c.stage_after && c.stage_before !== c.stage_after) return `${who}: ${words(c.stage_before)} to ${words(c.stage_after)}`;
  if (c.stage_after) return `${who}: now ${words(c.stage_after)}`;
  if (c.type) return `${who}: ${words(c.type)}`;
  return `${who}: changed`;
}

/** The roles in one line: "Hosts E2 · Guest at E5 · In the story E7". */
export function rolesLine(p) {
  const by = { host: [], guest: [], story: [] };
  for (const [n, role] of Object.entries(p?.roles || {})) (by[role] || by.story).push(Number(n));
  const list = (ns) => ns.sort((a, b) => a - b).map((n) => `E${n}`).join(', ');
  return [
    by.host.length && `Hosts ${list(by.host)}`,
    by.guest.length && `Guest at ${list(by.guest)}`,
    by.story.length && `In the story ${list(by.story)}`,
  ].filter(Boolean).join(' · ');
}

export const personHref = (p) => (p?.character_id ? `/character/${encodeURIComponent(p.character_id)}` : null);

export function useSeasonCast({ api, showId, season = null, reloadKey = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!api || !showId) return;
    try {
      const res = await api.get(`/api/v1/world/${showId}/season/cast${season ? `?season=${encodeURIComponent(season)}` : ''}`);
      setData(res.data || null);
      setError(null);
    } catch (err) {
      console.error('[seasonCast] load failed:', err);
      setError(err?.response?.data?.error || err?.message || 'The cast could not be read.');
    }
  }, [api, showId, season]);
  useEffect(() => { reload(); }, [reload, reloadKey]);
  return { data, error, reload };
}
