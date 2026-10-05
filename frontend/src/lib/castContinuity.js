/**
 * Producer Mode → Cast & Continuity (Evoni's redesign, 2026-10-05): Lala's
 * stats with what last moved them, the decision log of her episode results,
 * and the story threads as a strip of episode squares. Pure helpers over
 * GET /characters/lala/state, /world/:showId/history (newest first),
 * the show's episodes and /world/:showId/season/threads.
 */

/** Lala's stats in the order the card lists them; every stat but coins runs 0–10. */
export const STAT_ROWS = [
  { key: 'coins', label: 'Prime Coins' },
  { key: 'reputation', label: 'Reputation' },
  { key: 'brand_trust', label: 'Brand Trust' },
  { key: 'influence', label: 'Influence' },
  { key: 'stress', label: 'Stress' },
];

const parse = (value, fallback) => {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error('[castContinuity] bad JSON:', err);
    return fallback;
  }
};

/** A history row's stat changes, without the zeros. */
export function rowDeltas(row) {
  const deltas = parse(row?.deltas_json, {}) || {};
  return Object.entries(deltas).filter(([, v]) => typeof v === 'number' && v !== 0);
}

/** An episode's final tier ('slay', 'pass', …), or null. */
export function episodeTier(episode) {
  return parse(episode?.evaluation_json, null)?.tier_final || null;
}

/** What last moved a stat: the newest history row that changed it. */
export function lastChange(history, key, episodes = []) {
  for (const row of history || []) {
    const hit = rowDeltas(row).find(([k]) => k === key);
    if (!hit) continue;
    const episode = episodes.find((e) => e.id === row.episode_id) || null;
    return {
      delta: hit[1],
      source: row.source || null,
      episodeNumber: row.episode_number ?? episode?.episode_number ?? null,
      tier: episodeTier(episode),
      notes: row.notes || null,
    };
  }
  return null;
}

/** "Episode 3 result (SLAY)", "Wardrobe purchase", "Manual edit": where a change came from. */
export function describeChange(change) {
  if (!change) return null;
  if (change.episodeNumber != null) {
    return `Episode ${change.episodeNumber} result${change.tier ? ` (${change.tier.toUpperCase()})` : ''}`;
  }
  const source = String(change.source || 'manual').replace(/_/g, ' ');
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/** The episode the stats stand after: the newest history row with an episode. */
export function afterEpisode(history) {
  return (history || []).find((row) => row.episode_number != null)?.episode_number ?? null;
}

/** The decision log: Lala's episode results, newest first, each with what it did to her. */
export function decisionEntries(history, episodes = [], limit = 3) {
  return (history || [])
    .filter((row) => row.episode_id)
    .slice(0, limit)
    .map((row) => {
      const episode = episodes.find((e) => e.id === row.episode_id) || null;
      return {
        id: row.id || `${row.episode_id}-${row.created_at}`,
        episodeId: row.episode_id,
        episodeNumber: row.episode_number ?? episode?.episode_number ?? null,
        title: row.episode_title || episode?.title || 'Untitled episode',
        tier: episodeTier(episode),
        notes: row.notes || null,
        deltas: rowDeltas(row),
      };
    });
}

/** The newest episode number on the show: where the season stands. */
export function currentEpisodeNumber(episodes) {
  const numbers = (episodes || []).map((e) => Number(e.episode_number)).filter((n) => Number.isFinite(n) && n > 0);
  return numbers.length ? Math.max(...numbers) : 0;
}

/** One square per episode of the strip: filled where a slot carries the thread, ahead past the current episode. */
export function threadSquares(thread, span, current) {
  const on = new Set((thread?.slot_numbers || []).map(Number));
  return Array.from({ length: span }, (_, i) => ({ slot: i + 1, on: on.has(i + 1), ahead: i + 1 > current }));
}

/** How many squares the strip shows: eight, or up to the current episode or the furthest slot a thread holds, at most 24. */
export function stripSpan(threads, current) {
  const furthest = Math.max(0, ...(threads || []).flatMap((t) => (t.slot_numbers || []).map(Number)).filter(Number.isFinite));
  return Math.min(24, Math.max(8, current, furthest));
}

export const QUIET_AFTER = 3;

/** When a thread last came up: { text, quiet }. Quiet once QUIET_AFTER episodes pass without it. */
export function threadPulse(thread, episodes, current) {
  if (thread?.status === 'closed') return { text: 'Closed', quiet: false };
  const episode = (episodes || []).find((e) => e.id === thread?.last_advanced_episode_id);
  const last = episode ? Number(episode.episode_number) : null;
  if (!Number.isFinite(last)) return { text: 'Has not come up yet', quiet: false };
  const gap = current - last;
  if (gap >= QUIET_AFTER) return { text: `Quiet for ${gap} episodes`, quiet: true };
  return { text: `Came up in Episode ${last}`, quiet: false };
}
