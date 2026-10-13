'use strict';

/**
 * Audience tiers (Task #3033; Evoni, 2026-10-12; docs/reads/2026-10-12-pulse-decisions-read.md §2):
 * worked out from the canon follower count, each tier's lower bound
 * inclusive. They measure audience size only and never feed Influence,
 * which measures Lala's ability to affect the world.
 *
 *   TIERS            [{ key, label, from }], smallest first
 *   tierFor(count)   the tier for a count, or null when there is no count
 *
 * The stored 4-tier social_profiles.follower_tier stays as it is for
 * profile generation and scoring (her choice); reconciling the two is
 * later work. frontend/src/lib/pulseAudience.js mirrors this file and is
 * pinned to it by its test.
 */

const TIERS = [
  { key: 'emerging', label: 'Emerging', from: 0 },
  { key: 'nano', label: 'Nano', from: 1000 },
  { key: 'micro', label: 'Micro', from: 10000 },
  { key: 'mid', label: 'Mid-tier', from: 50000 },
  { key: 'macro', label: 'Macro', from: 250000 },
  { key: 'mega', label: 'Mega', from: 1000000 },
];

/** The tier a follower count falls in; null for no count (null, undefined, not a number). */
function tierFor(count) {
  if (count === null || count === undefined || count === '') return null;
  const n = Number(count);
  if (!Number.isFinite(n)) return null;
  let tier = TIERS[0];
  for (const t of TIERS) if (n >= t.from) tier = t;
  return { ...tier };
}

module.exports = { TIERS, tierFor };
