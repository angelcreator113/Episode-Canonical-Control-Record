'use strict';

/**
 * The stored follower tier, as the six count tiers (Task #3106; Evoni,
 * 2026-10-13: "rewrite the stored labels. Generation, prestige and follow
 * odds move to the six count tiers"). The keys are services/pulseAudience
 * TIERS', smallest first; a profile's stored social_profiles.follower_tier
 * is one of them, set once from its count (migration 20261013110000) and
 * then by generation. The Pulse still shows the tier live from the count.
 *
 *   FOLLOWER_TIER_KEYS        ['emerging', 'nano', 'micro', 'mid', 'macro', 'mega']
 *   DEFAULT_TIER_AFFINITY     the follow odds a character has by default, per tier
 *   withSixTiers(affinity)    a stored follow-odds map with Emerging and Nano
 *                             filled from its Micro value where missing
 *                             (Evoni: the new tiers copy each character's Micro)
 */

const { TIERS } = require('../services/pulseAudience');

const FOLLOWER_TIER_KEYS = Object.freeze(TIERS.map((t) => t.key));

const DEFAULT_TIER_AFFINITY = Object.freeze({ emerging: 0.60, nano: 0.60, micro: 0.60, mid: 0.70, macro: 0.75, mega: 0.65 });

function withSixTiers(affinity) {
  const out = { ...(affinity || {}) };
  if (out.micro == null) return out;
  for (const key of ['emerging', 'nano']) if (out[key] == null) out[key] = out.micro;
  return out;
}

module.exports = { FOLLOWER_TIER_KEYS, DEFAULT_TIER_AFFINITY, withSixTiers };
