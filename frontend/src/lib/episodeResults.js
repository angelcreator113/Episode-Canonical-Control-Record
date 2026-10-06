/**
 * Results as one page (Evoni's Episode mock, 2026-10-05; her ruling: one
 * page, with Evaluation, Story and Distribution kept). Pure helpers over
 * what the page reads: the episode (evaluation_json, teaser,
 * distribution_metadata), the brief (designed_intent), the episode's money
 * (GET /world/:showId/episodes/:id/money: lines, projection), Lala's state
 * (GET /characters/lala/state) and the episode's feed posts.
 */

export const TIER_LABEL = { slay: 'Slay', pass: 'Pass', safe: 'Safe', fail: 'Fail' };

export function evaluationOf(episode) {
  const raw = episode?.evaluation_json;
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (err) { console.error('[Results] evaluation_json parse failed:', err); return null; }
}

/** How it went: { designed, actual, done }, the labels or null. */
export function howItWent({ brief = null, evaluation = null } = {}) {
  const designed = brief?.designed_intent ? TIER_LABEL[brief.designed_intent] || brief.designed_intent : null;
  const actual = evaluation?.tier_final ? TIER_LABEL[evaluation.tier_final] || evaluation.tier_final : null;
  return { designed, actual, score: evaluation?.score ?? null, done: !!actual };
}

const STATE_TEXT = { planned: 'planned', pending: 'pending', posted: 'posted', not_earned: 'not earned', covered: 'covered' };

/**
 * Money settled: a row per money line ({ key, label, amount, note }), and
 * the episode's net ({ value, estimate }). Null without the money.
 */
export function moneyRows(money) {
  if (!money) return null;
  const rows = (money.lines || []).map((l) => ({
    key: l.key,
    label: l.label,
    amount: l.covered ? 0 : Number(l.signed) || 0,
    note: l.covered ? 'covered' : STATE_TEXT[l.state] || l.state || null,
  }));
  const p = money.projection || null;
  const net = p ? { value: p.projected_net, estimate: p.projected_net !== p.posted_net } : { value: Number(money.net) || 0, estimate: false };
  return { rows, net, bonus: (p?.conditional || []).map((c) => ({ tier: TIER_LABEL[c.tier] || c.tier, amount: c.amount })) };
}

export const STATS = [
  { key: 'coins', label: 'Prime Coins' },
  { key: 'reputation', label: 'Reputation' },
  { key: 'brand_trust', label: 'Brand Trust' },
  { key: 'influence', label: 'Influence' },
  { key: 'stress', label: 'Stress' },
];

/** Lala's stats: her current value and, once evaluated, this episode's change. */
export function statRows(state, evaluation) {
  const deltas = evaluation?.stat_deltas || null;
  return STATS.map((s) => ({
    ...s,
    value: state && state[s.key] != null ? Number(state[s.key]) : null,
    delta: deltas && deltas[s.key] != null ? Number(deltas[s.key]) : null,
  }));
}

/** Share: the teaser, the platform copy and the feed posts, each with its state. */
export function shareState(episode, posts = []) {
  const teaser = typeof episode?.teaser === 'string' && episode.teaser.trim() ? episode.teaser.trim() : null;
  let dm = episode?.distribution_metadata || null;
  if (typeof dm === 'string') { try { dm = JSON.parse(dm); } catch (err) { console.error('[Results] distribution_metadata parse failed:', err); dm = null; } }
  const platforms = dm && typeof dm === 'object' ? Object.keys(dm).filter((k) => dm[k] && (dm[k].title || dm[k].description || dm[k].caption)) : [];
  const live = (posts || []).filter((p) => p.status === 'live').length;
  return { teaser, platforms, posts: (posts || []).length, live };
}

export const signedCoins = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Number(n) || 0).toLocaleString()}`;
