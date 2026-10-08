/**
 * The Society tab's front page, to Evoni's mock (Lalas_Social_Media_Page_3,
 * 2026-10-06): Archetypes, Trending now, the career ladder, Legends. Pure:
 * SocietySummary loads and renders.
 *
 *   archetypeCounts  the ten Feed profile archetypes (social_profiles.
 *                    archetype; Evoni's ruling: "The 10 profile archetypes")
 *                    with how many LalaVerse profiles carry each, from
 *                    GET /social-profiles/analytics/composition.
 *   societyArchetypeCounts  the Society tab's fifteen (social_profiles.
 *                    society_archetype, 2026-10-08), from the same, for the
 *                    Archetypes sub-tab.
 *   trendBars        the Feed's trending topics (GET /feed-enhanced/:showId/
 *                    trending), most posts first, each as a share of the
 *                    biggest. The data counts posts and engagement only, so
 *                    a trend never claims rising or fading.
 *   careerLadder     the five career tiers (utils/eventStakes CAREER_TIERS)
 *                    top first, with Lala's: careerTierFromReputation's rule
 *                    (src/utils/careerTiers.js), ceil(reputation / 2) in 1-5.
 */
import { ARCHETYPE_LABELS } from '../pages/feed/feedConstants';
import { CAREER_TIERS } from '../utils/eventStakes';

/** The ten archetypes in the enum's order, with counts; total and unknown. */
export function archetypeCounts(composition) {
  const counts = composition?.archetypes || {};
  const rows = Object.entries(ARCHETYPE_LABELS).map(([key, label]) => ({ key, label, count: Number(counts[key]) || 0 }));
  const known = new Set(Object.keys(ARCHETYPE_LABELS));
  const other = Object.entries(counts).filter(([k]) => !known.has(k)).reduce((n, [, v]) => n + (Number(v) || 0), 0);
  const total = rows.reduce((n, r) => n + r.count, 0) + other;
  return { rows: [...rows].sort((a, b) => b.count - a.count), total, other };
}

// A Society archetype's name as src/services/societyArchetypes.js compares
// it: case, a leading "The", punctuation.
const nameKey = (v) => (typeof v === 'string' ? v : '').trim().toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The Society tab's archetypes (the list the page shows, Evoni's edits
 * included; fix-list item 26) with how many LalaVerse profiles carry each,
 * from the same composition: { count(name), unset, other }. unset is the
 * profiles made before they had one; other, names no longer on the list.
 */
export function societyArchetypeCounts(composition, list) {
  const used = new Map();
  for (const [name, n] of Object.entries(composition?.society_archetypes || {})) {
    const key = nameKey(name);
    if (key) used.set(key, (used.get(key) || 0) + (Number(n) || 0));
  }
  const listed = new Set((list || []).map((a) => nameKey(a?.name)).filter(Boolean));
  const other = [...used].filter(([key]) => !listed.has(key)).reduce((n, [, v]) => n + v, 0);
  return {
    count: (name) => used.get(nameKey(name)) || 0,
    unset: Number(composition?.society_archetype_unset) || 0,
    other,
  };
}

/** Trending topics as bars: [{ topic, posts, engagement, share }], most posts first. */
export function trendBars(trending, limit = 6) {
  const rows = (trending || [])
    .filter((t) => t?.topic)
    .map((t) => ({ topic: t.topic, posts: Number(t.post_count) || 0, engagement: Number(t.total_engagement) || 0 }))
    .sort((a, b) => b.posts - a.posts || b.engagement - a.engagement)
    .slice(0, limit);
  const top = rows[0]?.posts || 0;
  return rows.map((r) => ({ ...r, share: top ? Math.max(0.06, r.posts / top) : 0 }));
}

/** Lala's tier from her reputation (src/utils/careerTiers.js careerTierFromReputation). */
export function tierFromReputation(reputation) {
  if (reputation == null || reputation === '' || Number.isNaN(Number(reputation))) return null;
  return Math.min(5, Math.max(1, Math.ceil(Number(reputation) / 2)));
}

/** The ladder top first: [{ tier, label, reputation, here }]. */
export function careerLadder(reputation) {
  const lala = tierFromReputation(reputation);
  return Object.entries(CAREER_TIERS)
    .map(([n, t]) => ({ tier: Number(n), label: t.label, reputation: t.reputation, here: Number(n) === lala }))
    .sort((a, b) => b.tier - a.tier);
}
