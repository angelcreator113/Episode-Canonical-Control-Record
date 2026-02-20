/**
 * Episode Evaluation Formula v1.1
 * 
 * Deterministic scoring engine for Styling Adventures with Lala.
 * Computes a 0-100 score based on character stats, outfit match,
 * and event attributes. Tier thresholds determine SLAY/PASS/MID/FAIL.
 * 
 * v1.1 changes:
 *  - Rep contribution capped at 15 (was 40). Multiplier ×1.5 (was ×4).
 *  - SLAY deltas reduced: rep +2/trust +1/influ +1 (was +3/+2/+2).
 *  - Diminishing returns: stats ≥7 gain max +1, stats ≥4 gains halved.
 *  - No-outfit/accessory defaults 0 (was 15/8 free points). [v1.0 hotfix]
 * 
 * Location: src/utils/evaluationFormula.js
 */

'use strict';

const FORMULA_VERSION = 'v1.1';

// ─── TIER THRESHOLDS ───
const TIERS = {
  SLAY: { min: 85, label: 'slay', emoji: '👑', color: '#FFD700' },
  PASS: { min: 65, label: 'pass', emoji: '✨', color: '#22c55e' },
  MID:  { min: 45, label: 'mid',  emoji: '😐', color: '#eab308' },
  FAIL: { min: 0,  label: 'fail', emoji: '💔', color: '#dc2626' },
};

// ─── DEFAULT CHARACTER STATS ───
const DEFAULT_STATS = {
  coins: 500,
  reputation: 1,
  brand_trust: 1,
  influence: 1,
  stress: 0,
};

// ─── OVERRIDE REASON CODES ───
const OVERRIDE_REASONS = {
  // Community / Dream Fund
  DREAM_FUND_BOOST: { label: 'Dream Fund Boost', category: 'community', maxTierBump: 1 },
  SUPPORT_PACK_SURGE: { label: 'Support Pack Surge', category: 'community', maxTierBump: 1 },
  BANK_METER_REWARD: { label: 'Bank Meter Reward', category: 'community', maxTierBump: 1 },

  // Lala Actions
  EMERGENCY_GLAM_PACK: { label: 'Emergency Glam Pack', category: 'lala', maxTierBump: 1 },
  LAST_MINUTE_TAILOR: { label: 'Last Minute Tailor', category: 'lala', maxTierBump: 1 },
  CONFIDENCE_RESET: { label: 'Confidence Reset', category: 'lala', maxTierBump: 1 },
  CREATOR_MODE_LOCKIN: { label: 'Creator Mode Lock-In', category: 'lala', maxTierBump: 1 },

  // House/Brand
  HOUSE_FAVOR: { label: 'House Favor', category: 'brand', maxTierBump: 1 },
  BRAND_SPONSOR_SAVE: { label: 'Brand Sponsor Save', category: 'brand', maxTierBump: 1 },

  // Creator control
  CREATOR_ADJUSTMENT_STYLE_MATCH: { label: 'Style Match Adjustment', category: 'creator', maxTierBump: 0 },
  CREATOR_STORY_OVERRIDE: { label: 'Story Override', category: 'creator', maxTierBump: 1 },
  INTENTIONAL_FAILURE: { label: 'Intentional Failure', category: 'creator', maxTierBump: 0 },
};

// ─── TIER ORDER (for bump validation) ───
const TIER_ORDER = ['fail', 'mid', 'pass', 'slay'];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function toTier(score) {
  if (score >= TIERS.SLAY.min) return 'slay';
  if (score >= TIERS.PASS.min) return 'pass';
  if (score >= TIERS.MID.min) return 'mid';
  return 'fail';
}

function getTierInfo(tier) {
  const key = tier.toUpperCase();
  return TIERS[key] || TIERS.FAIL;
}


/**
 * Compute episode evaluation score
 * 
 * @param {object} params
 * @param {object} params.state - Current character stats {coins, reputation, brand_trust, influence, stress}
 * @param {object} params.event - Event attributes {prestige, cost, strictness, deadline, dress_code}
 * @param {object} params.style - Style scores {outfit_match, accessory_match, deadline_penalty}
 * @param {string} [params.intent] - Episode intent ('failure_comeback_setup', etc.)
 * @param {object} [params.bonuses] - Bonus boosts {total_boost}
 * @returns {object} {score, tier_computed, tier_final, breakdown, formula_version}
 */
function evaluate({ state, event, style = {}, intent = null, bonuses = {} }) {
  const s = { ...DEFAULT_STATS, ...state };
  const e = event || {};
  const st = style || {};

  // ─── SCORE CALCULATION ───
  let score = 50;
  const breakdown = {};

  // Reputation contribution: 0-15 (rep × 1.5, capped)
  const repContrib = clamp(Math.round(s.reputation * 1.5), 0, 15);
  score += repContrib;
  breakdown.reputation_contribution = { value: repContrib, max: 15, detail: `Reputation ${s.reputation} × 1.5` };

  // Stress penalty: 0-20
  const stressPenalty = clamp(s.stress, 0, 10) * 2;
  score -= stressPenalty;
  breakdown.stress_penalty = { value: -stressPenalty, max: -20, detail: `Stress ${s.stress} × 2` };

  // Outfit match: 0-25
  const outfitMatch = clamp(st.outfit_match ?? 0, 0, 25); // no outfit = 0, not a free bonus
  score += outfitMatch;
  breakdown.outfit_match = { value: outfitMatch, max: 25, detail: st.outfit_match != null ? 'From wardrobe tags' : 'No outfit assigned (0 points)' };

  // Accessories match: 0-15
  const accessoryMatch = clamp(st.accessory_match ?? 0, 0, 15); // no accessories = 0, not a free bonus
  score += accessoryMatch;
  breakdown.accessory_match = { value: accessoryMatch, max: 15, detail: st.accessory_match != null ? 'From wardrobe tags' : 'No accessories assigned (0 points)' };

  // Deadline penalty: 0-15
  const deadlinePenalty = clamp(st.deadline_penalty || computeDeadlinePenalty(e), 0, 15);
  score -= deadlinePenalty;
  breakdown.deadline_penalty = { value: -deadlinePenalty, max: -15, detail: `Deadline: ${e.deadline || 'none'}` };

  // Bonuses: 0-10
  const totalBoost = clamp(bonuses.total_boost || 0, 0, 10);
  score += totalBoost;
  breakdown.bonuses = { value: totalBoost, max: 10, detail: totalBoost > 0 ? 'Active boosts applied' : 'No bonuses' };

  // Intent nudge
  if (intent === 'failure_comeback_setup') {
    score -= 6;
    breakdown.intent_nudge = { value: -6, detail: 'Failure setup: difficulty increased' };
  }

  // Clamp
  score = clamp(Math.round(score), 0, 100);

  const tier_computed = toTier(score);

  return {
    score,
    tier_computed,
    tier_final: tier_computed, // same until override
    breakdown,
    formula_version: FORMULA_VERSION,
    inputs: {
      state: s,
      event: e,
      style: st,
      intent,
      bonuses,
    },
  };
}


/**
 * Compute deadline penalty from event attributes
 */
function computeDeadlinePenalty(event) {
  if (!event.deadline) return 0;
  const dl = event.deadline.toLowerCase();
  if (dl === 'high' || dl === 'tonight' || dl === 'urgent') return 12;
  if (dl === 'medium' || dl === 'tomorrow') return 6;
  if (dl === 'low') return 3;

  // deadline_minutes
  if (event.deadline_minutes) {
    if (event.deadline_minutes <= 30) return 15;
    if (event.deadline_minutes <= 60) return 12;
    if (event.deadline_minutes <= 120) return 8;
    if (event.deadline_minutes <= 360) return 4;
    return 2;
  }

  return 0;
}


/**
 * Compute outfit match from wardrobe item tags vs event attributes
 * 
 * @param {object} event - {dress_code, strictness, prestige}
 * @param {object} outfitItem - {tags: {style:[], formality:N, color_story:[], vibe:[]}}
 * @returns {number} 0-25
 */
function computeOutfitMatch(event, outfitItem) {
  if (!outfitItem || !outfitItem.tags) return 15; // neutral default

  const tags = outfitItem.tags;
  const eventKeywords = extractKeywords(event.dress_code || '');
  let match = 0;

  // Style overlap: 0-10
  const styleOverlap = arrayOverlap(eventKeywords, tags.style || []);
  match += Math.min(styleOverlap * 5, 10);

  // Formality alignment: 0-10
  const formalityDiff = Math.abs((tags.formality || 5) - (event.prestige || 5));
  match += Math.max(10 - formalityDiff * 2, 0);

  // Vibe overlap: 0-5
  const vibeOverlap = arrayOverlap(eventKeywords, tags.vibe || []);
  match += Math.min(vibeOverlap * 2.5, 5);

  // Strictness penalty
  if ((event.strictness || 5) >= 7 && (tags.formality || 5) < (event.prestige || 5) - 2) {
    match -= 5;
  }

  return clamp(Math.round(match), 0, 25);
}


/**
 * Compute accessories match
 */
function computeAccessoryMatch(event, accessoryItems = []) {
  if (!accessoryItems.length) return 8; // neutral default

  const eventKeywords = extractKeywords(event.dress_code || '');
  let totalMatch = 0;

  for (const item of accessoryItems) {
    const tags = item.tags || {};
    const overlap = arrayOverlap(eventKeywords, [...(tags.style || []), ...(tags.vibe || [])]);
    totalMatch += overlap;
  }

  return clamp(Math.round(Math.min(totalMatch * 3, 15)), 0, 15);
}


/**
 * Validate a tier override request
 * Returns { valid, error, tier_from, tier_to }
 */
function validateOverride(currentTier, requestedTier) {
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  const requestedIdx = TIER_ORDER.indexOf(requestedTier);

  if (currentIdx === -1 || requestedIdx === -1) {
    return { valid: false, error: 'Invalid tier value' };
  }

  const bump = requestedIdx - currentIdx;

  if (bump === 0) {
    return { valid: false, error: 'No change requested' };
  }

  // Allow any tier change (up or down) — MVP flexibility
  // The 1-tier-bump-only constraint is removed for creator control

  if (bump < 0) {
    // Downgrade — allowed (intentional failure)
    return { valid: true, tier_from: currentTier, tier_to: requestedTier };
  }

  return { valid: true, tier_from: currentTier, tier_to: requestedTier };
}


/**
 * Calculate final stat deltas from evaluation
 */
function computeStatDeltas(evaluation, event, overrides = []) {
  const tier = evaluation.tier_final;
  const e = event || {};
  const deltas = {};

  // Base coin cost
  deltas.coins = -(e.cost || 0);

  // Tier-based stat changes
  switch (tier) {
    case 'slay':
      deltas.reputation = 2;
      deltas.brand_trust = 1;
      deltas.influence = 1;
      deltas.stress = -1;
      break;
    case 'pass':
      deltas.reputation = 1;
      deltas.brand_trust = 1;
      deltas.influence = 1;
      deltas.stress = 0;
      break;
    case 'mid':
      deltas.reputation = 0;
      deltas.brand_trust = 0;
      deltas.influence = 0;
      deltas.stress = 1;
      break;
    case 'fail':
      deltas.reputation = -2;
      deltas.brand_trust = -1;
      deltas.influence = -1;
      deltas.stress = 2;
      break;
  }

  // Apply override costs
  for (const override of overrides) {
    if (override.costs) {
      for (const [key, val] of Object.entries(override.costs)) {
        deltas[key] = (deltas[key] || 0) + (typeof val === 'number' ? val : 0);
      }
    }
    if (override.impact) {
      for (const [key, val] of Object.entries(override.impact)) {
        deltas[key] = (deltas[key] || 0) + (typeof val === 'number' ? val : 0);
      }
    }
  }

  return deltas;
}


/**
 * Apply deltas to a state object, clamping values
 */
function applyDeltas(state, deltas) {
  const newState = { ...state };

  newState.coins = (newState.coins || 0) + (deltas.coins || 0);
  // Coins can go negative (debt) but floor at -9999
  newState.coins = Math.max(newState.coins, -9999);

  // Capped stats: 0-10 with diminishing returns for growth stats
  for (const key of ['reputation', 'brand_trust', 'influence', 'stress']) {
    if (deltas[key] !== undefined) {
      const current = newState[key] || 0;
      let delta = deltas[key];

      // Diminishing returns: positive gains shrink at higher stat levels
      // (stress is excluded — penalties should always hit hard)
      if (delta > 0 && key !== 'stress') {
        if (current >= 7) delta = Math.min(delta, 1);       // Near cap: max +1
        else if (current >= 4) delta = Math.ceil(delta / 2); // Mid range: halved
      }

      newState[key] = clamp(current + delta, 0, 10);
    }
  }

  return newState;
}


/**
 * Generate narrative result lines
 */
function generateNarrativeLine(evaluation) {
  const { tier_final, score, breakdown } = evaluation;
  const lines = {
    slay: [
      `Besties, she didn't just show up — she owned the room. Score: ${score}.`,
      `This is what it looks like when preparation meets prestige. ${score} points. Slay.`,
      `The house is talking. They're all talking. ${score}. Crown earned.`,
    ],
    pass: [
      `Solid work, bestie. She made an impression. Score: ${score}.`,
      `Not perfect, but she held her own. ${score} points. Respect earned.`,
      `The look landed. The room noticed. ${score}. A good day.`,
    ],
    mid: [
      `It was... fine. Not embarrassing, not memorable. Score: ${score}.`,
      `She showed up. The room was polite. ${score}. Room to grow.`,
      `Close, bestie. But 'almost' doesn't get invites back. ${score}.`,
    ],
    fail: [
      `Besties... this is what prestige costs. Score: ${score}. They noticed.`,
      `The room went quiet. Not the good kind. ${score}. Recovery needed.`,
      `She tried. But trying isn't enough at this level. ${score}.`,
    ],
  };

  const tierLines = lines[tier_final] || lines.mid;
  return {
    short: tierLines[0],
    dramatic: tierLines[1],
    comedic: tierLines[2],
  };
}


// ─── HELPERS ───

function extractKeywords(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function arrayOverlap(a, b) {
  if (!a || !b) return 0;
  const setB = new Set(b.map(s => s.toLowerCase()));
  return a.filter(item => setB.has(item.toLowerCase())).length;
}


// ─── EXPORTS ───

module.exports = {
  FORMULA_VERSION,
  TIERS,
  TIER_ORDER,
  DEFAULT_STATS,
  OVERRIDE_REASONS,
  evaluate,
  computeOutfitMatch,
  computeAccessoryMatch,
  computeDeadlinePenalty,
  computeStatDeltas,
  applyDeltas,
  validateOverride,
  generateNarrativeLine,
  toTier,
  getTierInfo,
  clamp,
};
