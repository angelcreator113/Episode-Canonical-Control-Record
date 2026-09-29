'use strict';

/**
 * The five career tiers (Task #2317), the canonical scale for
 * world_events.career_tier (migration 20260219000004 comment) and Lala's
 * accessible tier. It matches frontend/src/utils/eventStakes.js
 * CAREER_TIERS and WorldAdmin's Career Tier select.
 *
 *   1 Emerging     reputation 0–2
 *   2 Rising       reputation 3–4
 *   3 Established  reputation 5–6
 *   4 Influential  reputation 7–8
 *   5 Elite        reputation 9–10
 */

const CAREER_TIERS = {
  1: { key: 'emerging', label: 'Emerging', minReputation: 0, maxReputation: 2 },
  2: { key: 'rising', label: 'Rising', minReputation: 3, maxReputation: 4 },
  3: { key: 'established', label: 'Established', minReputation: 5, maxReputation: 6 },
  4: { key: 'influential', label: 'Influential', minReputation: 7, maxReputation: 8 },
  5: { key: 'elite', label: 'Elite', minReputation: 9, maxReputation: 10 },
};

const TIER_BY_KEY = Object.fromEntries(Object.entries(CAREER_TIERS).map(([n, t]) => [t.key, Number(n)]));

/** 'Elite' → 5, 'influential' → 4; anything else → null. */
function careerTierFromLabel(label) {
  if (typeof label !== 'string') return null;
  return TIER_BY_KEY[label.trim().toLowerCase()] ?? null;
}

/** Lala's accessible tier from her 0–10 reputation, by the bands above. */
function careerTierFromReputation(reputation) {
  const rep = Number(reputation) || 0;
  return Math.min(5, Math.max(1, Math.ceil(rep / 2)));
}

module.exports = { CAREER_TIERS, careerTierFromLabel, careerTierFromReputation };
