'use strict';

/**
 * The analyze-image price guide (Task #2347).
 *
 * Replaces the prompt's old "minimum $150" floor. The AI prices an item from
 * its item_type and tier, using these US-dollar ranges. The result is a
 * suggestion: the upload form fills it only into an empty price field and
 * never overwrites a price that is already set.
 *
 * STARTER TABLE, pending Evoni's approval in the PR. Rows are the prompt's
 * item_type values; columns are the Wardrobe tier values
 * (basic | mid | luxury | elite).
 */

const PRICE_TIERS = Object.freeze(['basic', 'mid', 'luxury', 'elite']);

// [low, high] in US dollars, per item_type and tier.
const PRICE_RANGES = Object.freeze({
  dress:      { basic: [40, 120], mid: [120, 400], luxury: [400, 2500], elite: [2500, 15000] },
  top:        { basic: [20, 80],  mid: [80, 250],  luxury: [250, 1200], elite: [1200, 5000] },
  bottom:     { basic: [30, 90],  mid: [90, 300],  luxury: [300, 1500], elite: [1500, 6000] },
  shoes:      { basic: [40, 120], mid: [120, 400], luxury: [400, 1500], elite: [1500, 5000] },
  accessory:  { basic: [15, 60],  mid: [60, 200],  luxury: [200, 800],  elite: [800, 3000] },
  jewelry:    { basic: [20, 80],  mid: [80, 400],  luxury: [400, 5000], elite: [5000, 50000] },
  bag:        { basic: [40, 150], mid: [150, 600], luxury: [600, 4000], elite: [4000, 25000] },
  outerwear:  { basic: [60, 180], mid: [180, 600], luxury: [600, 3500], elite: [3500, 20000] },
  swimwear:   { basic: [25, 80],  mid: [80, 200],  luxury: [200, 600],  elite: [600, 1500] },
  activewear: { basic: [20, 70],  mid: [70, 150],  luxury: [150, 400],  elite: [400, 1000] },
});

const dollars = (n) => `$${n.toLocaleString('en-US')}`;

/** The table as prompt text, one line per item_type. */
function priceGuideText() {
  const lines = Object.entries(PRICE_RANGES).map(([type, byTier]) =>
    `- ${type}: ${PRICE_TIERS.map((t) => `${t} ${dollars(byTier[t][0])}–${dollars(byTier[t][1])}`).join(', ')}`
  );
  return `PRICE GUIDE (US dollars, by item_type and tier). Decide the tier first, then give a price_estimate inside that item_type's range for that tier; place it higher or lower in the range by material, construction and detail. There is no minimum price.\n${lines.join('\n')}`;
}

module.exports = { PRICE_TIERS, PRICE_RANGES, priceGuideText };
