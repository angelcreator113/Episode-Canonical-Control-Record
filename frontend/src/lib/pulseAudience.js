/**
 * Audience tiers from the follower count (Task 3033; Evoni, 2026-10-12):
 * the frontend mirror of src/services/pulseAudience.js, pinned to it by
 * pulseAudience.test.js. Each tier's lower bound is inclusive. Audience
 * size only: never Influence.
 */
export const TIERS = [
  { key: 'emerging', label: 'Emerging', from: 0 },
  { key: 'nano', label: 'Nano', from: 1000 },
  { key: 'micro', label: 'Micro', from: 10000 },
  { key: 'mid', label: 'Mid-tier', from: 50000 },
  { key: 'macro', label: 'Macro', from: 250000 },
  { key: 'mega', label: 'Mega', from: 1000000 },
];

/** The tier a follower count falls in; null for no count. */
export function tierFor(count) {
  if (count === null || count === undefined || count === '') return null;
  const n = Number(count);
  if (!Number.isFinite(n)) return null;
  let tier = TIERS[0];
  for (const t of TIERS) if (n >= t.from) tier = t;
  return { ...tier };
}

/** "Nano tier" ("Mid-tier" as it is), or '' with no count. */
export const tierLabel = (count) => {
  const tier = tierFor(count);
  if (!tier) return '';
  return /tier$/i.test(tier.label) ? tier.label : `${tier.label} tier`;
};

/**
 * The header's follower line (Task 3062) from the Lala profile read's
 * `followers`: "12,400 followers · Micro tier" from her canon count, or
 * "About 12K followers (estimate)" before her starting count is accepted;
 * '' with neither.
 */
export function followersText(followers) {
  if (!followers) return '';
  if (Number.isFinite(Number(followers.count)) && followers.count !== null) {
    const n = Number(followers.count);
    const tier = tierLabel(n);
    return `${n.toLocaleString('en-US')} follower${n === 1 ? '' : 's'}${tier ? ` · ${tier}` : ''}`;
  }
  return followers.estimate ? `About ${followers.estimate} followers (estimate)` : '';
}
