/**
 * evaluationFormula Unit Tests
 * Tests scoring engine, tier calculations, stat deltas, and override validation
 */

const {
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
} = require('../../../src/utils/evaluationFormula');

describe('evaluationFormula', () => {
  describe('constants', () => {
    it('should export correct formula version', () => {
      expect(FORMULA_VERSION).toBe('v1.2');
    });

    it('should define SLAY tier at min 85', () => {
      expect(TIERS.SLAY.min).toBe(85);
      expect(TIERS.SLAY.label).toBe('slay');
    });

    it('should define PASS tier at min 65', () => {
      expect(TIERS.PASS.min).toBe(65);
      expect(TIERS.PASS.label).toBe('pass');
    });

    it('should define SAFE tier at min 45', () => {
      expect(TIERS.SAFE.min).toBe(45);
      expect(TIERS.SAFE.label).toBe('safe');
    });

    it('should define FAIL tier at min 0', () => {
      expect(TIERS.FAIL.min).toBe(0);
      expect(TIERS.FAIL.label).toBe('fail');
    });

    it('should have default stats with expected keys', () => {
      expect(DEFAULT_STATS).toMatchObject({
        coins: 500,
        reputation: 1,
        brand_trust: 1,
        influence: 1,
        stress: 0,
      });
    });

    it('should export TIER_ORDER array with 4 tiers', () => {
      expect(TIER_ORDER).toEqual(['fail', 'safe', 'pass', 'slay']);
    });

    it('should export OVERRIDE_REASONS with known codes', () => {
      expect(OVERRIDE_REASONS.DREAM_FUND_BOOST).toBeDefined();
      expect(OVERRIDE_REASONS.INTENTIONAL_FAILURE).toBeDefined();
      expect(OVERRIDE_REASONS.CREATOR_STORY_OVERRIDE).toBeDefined();
    });
  });

  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should return min when value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should return max when value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle boundary values', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('toTier', () => {
    it('should return slay for score >= 85', () => {
      expect(toTier(85)).toBe('slay');
      expect(toTier(100)).toBe('slay');
      expect(toTier(90)).toBe('slay');
    });

    it('should return pass for score 65-84', () => {
      expect(toTier(65)).toBe('pass');
      expect(toTier(84)).toBe('pass');
      expect(toTier(75)).toBe('pass');
    });

    it('should return safe for score 45-64', () => {
      expect(toTier(45)).toBe('safe');
      expect(toTier(64)).toBe('safe');
      expect(toTier(55)).toBe('safe');
    });

    it('should return fail for score 0-44', () => {
      expect(toTier(0)).toBe('fail');
      expect(toTier(44)).toBe('fail');
      expect(toTier(20)).toBe('fail');
    });
  });

  describe('getTierInfo', () => {
    it('should return tier info for slay', () => {
      const info = getTierInfo('slay');
      expect(info.label).toBe('slay');
      expect(info.emoji).toBe('👑');
    });

    it('should return tier info for pass', () => {
      const info = getTierInfo('pass');
      expect(info.label).toBe('pass');
      expect(info.emoji).toBe('✨');
    });

    it('should return FAIL tier info for unknown tier', () => {
      const info = getTierInfo('unknown');
      expect(info).toEqual(TIERS.FAIL);
    });

    it('should be case-insensitive', () => {
      const info = getTierInfo('SLAY');
      expect(info.label).toBe('slay');
    });
  });

  describe('evaluate', () => {
    const baseState = { reputation: 5, brand_trust: 5, influence: 5, stress: 0, coins: 500 };
    const baseEvent = {};
    const baseStyle = { outfit_match: 20, accessory_match: 10 };

    it('should return an object with required fields', () => {
      const result = evaluate({ state: baseState, event: baseEvent, style: baseStyle });
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('tier_computed');
      expect(result).toHaveProperty('tier_final');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('formula_version', 'v1.2');
      expect(result).toHaveProperty('inputs');
    });

    it('should compute a numeric score between 0 and 100', () => {
      const result = evaluate({ state: baseState, event: baseEvent, style: baseStyle });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should use default stats when state is empty', () => {
      const result = evaluate({ state: {}, event: {}, style: {} });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should apply rep contribution (0-15)', () => {
      const highRep = evaluate({ state: { ...DEFAULT_STATS, reputation: 10 }, event: {}, style: {} });
      const lowRep = evaluate({ state: { ...DEFAULT_STATS, reputation: 0 }, event: {}, style: {} });
      expect(highRep.score).toBeGreaterThan(lowRep.score);
    });

    it('should apply stress penalty', () => {
      const noStress = evaluate({ state: { ...DEFAULT_STATS, stress: 0 }, event: {}, style: {} });
      const highStress = evaluate({ state: { ...DEFAULT_STATS, stress: 10 }, event: {}, style: {} });
      expect(highStress.score).toBeLessThan(noStress.score);
    });

    it('should apply outfit_match bonus', () => {
      const withOutfit = evaluate({ state: DEFAULT_STATS, event: {}, style: { outfit_match: 25 } });
      const noOutfit = evaluate({ state: DEFAULT_STATS, event: {}, style: { outfit_match: 0 } });
      expect(withOutfit.score).toBeGreaterThan(noOutfit.score);
    });

    it('should apply accessory_match bonus', () => {
      const withAccessory = evaluate({ state: DEFAULT_STATS, event: {}, style: { accessory_match: 15 } });
      const noAccessory = evaluate({ state: DEFAULT_STATS, event: {}, style: { accessory_match: 0 } });
      expect(withAccessory.score).toBeGreaterThan(noAccessory.score);
    });

    it('should apply deadline penalty from event', () => {
      const urgentEvent = evaluate({ state: DEFAULT_STATS, event: { deadline: 'urgent' }, style: {} });
      const noDeadline = evaluate({ state: DEFAULT_STATS, event: {}, style: {} });
      expect(urgentEvent.score).toBeLessThan(noDeadline.score);
    });

    it('should apply intent nudge for failure_comeback_setup', () => {
      const normal = evaluate({ state: DEFAULT_STATS, event: {}, style: {}, intent: null });
      const failureSetup = evaluate({ state: DEFAULT_STATS, event: {}, style: {}, intent: 'failure_comeback_setup' });
      expect(failureSetup.score).toBeLessThan(normal.score);
      expect(failureSetup.score).toBe(normal.score - 6);
    });

    it('should apply bonuses (capped at 10)', () => {
      const withBonus = evaluate({ state: DEFAULT_STATS, event: {}, style: {}, bonuses: { total_boost: 10 } });
      const noBonus = evaluate({ state: DEFAULT_STATS, event: {}, style: {}, bonuses: {} });
      expect(withBonus.score).toBe(noBonus.score + 10);
    });

    it('should cap bonuses at 10 even if higher value provided', () => {
      const bigBonus = evaluate({ state: DEFAULT_STATS, event: {}, style: {}, bonuses: { total_boost: 99 } });
      const maxBonus = evaluate({ state: DEFAULT_STATS, event: {}, style: {}, bonuses: { total_boost: 10 } });
      expect(bigBonus.score).toBe(maxBonus.score);
    });

    it('should include breakdown with all expected keys', () => {
      const result = evaluate({ state: baseState, event: baseEvent, style: baseStyle });
      expect(result.breakdown).toHaveProperty('reputation_contribution');
      expect(result.breakdown).toHaveProperty('stress_penalty');
      expect(result.breakdown).toHaveProperty('outfit_match');
      expect(result.breakdown).toHaveProperty('accessory_match');
      expect(result.breakdown).toHaveProperty('deadline_penalty');
      expect(result.breakdown).toHaveProperty('bonuses');
    });

    it('should set tier_final equal to tier_computed (no override applied)', () => {
      const result = evaluate({ state: baseState, event: baseEvent, style: baseStyle });
      expect(result.tier_final).toBe(result.tier_computed);
    });

    it('should produce slay tier for very high stats', () => {
      const result = evaluate({
        state: { reputation: 10, stress: 0, coins: 1000 },
        event: {},
        style: { outfit_match: 25, accessory_match: 15 },
        bonuses: { total_boost: 10 },
      });
      expect(result.tier_computed).toBe('slay');
    });

    it('should produce fail tier for very low stats and high stress', () => {
      const result = evaluate({
        state: { reputation: 0, stress: 10, coins: 0 },
        event: { deadline: 'urgent' },
        style: { outfit_match: 0, accessory_match: 0 },
      });
      expect(result.tier_computed).toBe('fail');
    });
  });

  describe('computeDeadlinePenalty', () => {
    it('should return 0 for no deadline', () => {
      expect(computeDeadlinePenalty({})).toBe(0);
    });

    it('should return 12 for urgent deadline', () => {
      expect(computeDeadlinePenalty({ deadline: 'urgent' })).toBe(12);
    });

    it('should return 12 for tonight deadline', () => {
      expect(computeDeadlinePenalty({ deadline: 'tonight' })).toBe(12);
    });

    it('should return 12 for high deadline', () => {
      expect(computeDeadlinePenalty({ deadline: 'high' })).toBe(12);
    });

    it('should return 6 for medium deadline', () => {
      expect(computeDeadlinePenalty({ deadline: 'medium' })).toBe(6);
    });

    it('should return 6 for tomorrow deadline', () => {
      expect(computeDeadlinePenalty({ deadline: 'tomorrow' })).toBe(6);
    });

    it('should return 3 for low deadline', () => {
      expect(computeDeadlinePenalty({ deadline: 'low' })).toBe(3);
    });

    it('should return 15 for deadline_minutes <= 30', () => {
      expect(computeDeadlinePenalty({ deadline: 'custom', deadline_minutes: 30 })).toBe(15);
    });

    it('should return 12 for deadline_minutes <= 60', () => {
      expect(computeDeadlinePenalty({ deadline: 'custom', deadline_minutes: 60 })).toBe(12);
    });

    it('should return 8 for deadline_minutes <= 120', () => {
      expect(computeDeadlinePenalty({ deadline: 'custom', deadline_minutes: 120 })).toBe(8);
    });

    it('should return 4 for deadline_minutes <= 360', () => {
      expect(computeDeadlinePenalty({ deadline: 'custom', deadline_minutes: 360 })).toBe(4);
    });

    it('should return 2 for deadline_minutes > 360', () => {
      expect(computeDeadlinePenalty({ deadline: 'custom', deadline_minutes: 361 })).toBe(2);
    });

    it('should be case-insensitive', () => {
      expect(computeDeadlinePenalty({ deadline: 'URGENT' })).toBe(12);
      expect(computeDeadlinePenalty({ deadline: 'Medium' })).toBe(6);
    });
  });

  describe('computeOutfitMatch', () => {
    it('should return neutral default 15 when no outfit provided', () => {
      expect(computeOutfitMatch({}, null)).toBe(15);
    });

    it('should return neutral default 15 when outfit has no tags', () => {
      expect(computeOutfitMatch({}, {})).toBe(15);
    });

    it('should compute style overlap contribution', () => {
      const event = { dress_code: 'elegant formal' };
      const outfit = { tags: { style: ['elegant', 'formal'], formality: 5, vibe: [] } };
      const result = computeOutfitMatch(event, outfit);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(25);
    });

    it('should apply strictness penalty for mismatched formality', () => {
      const strictEvent = { strictness: 9, prestige: 9 };
      const casualOutfit = { tags: { formality: 1, style: [], vibe: [] } };
      const result = computeOutfitMatch(strictEvent, casualOutfit);
      // Should lose points due to strictness penalty
      expect(result).toBeLessThanOrEqual(25);
    });

    it('should return value in 0-25 range', () => {
      const event = { dress_code: 'casual fun vibes', strictness: 3, prestige: 3 };
      const outfit = { tags: { style: ['casual'], formality: 3, vibe: ['fun', 'casual'] } };
      const result = computeOutfitMatch(event, outfit);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(25);
    });
  });

  describe('computeAccessoryMatch', () => {
    it('should return neutral default 8 for no accessories', () => {
      expect(computeAccessoryMatch({}, [])).toBe(8);
    });

    it('should compute match based on tag overlap', () => {
      const event = { dress_code: 'glamour glam' };
      const accessories = [{ tags: { style: ['glamour'], vibe: ['glam'] } }];
      const result = computeAccessoryMatch(event, accessories);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(15);
    });

    it('should return value in 0-15 range with many accessories', () => {
      const event = { dress_code: 'elegant chic bold' };
      const accessories = [
        { tags: { style: ['elegant'], vibe: ['chic'] } },
        { tags: { style: ['bold', 'chic'], vibe: ['elegant'] } },
      ];
      const result = computeAccessoryMatch(event, accessories);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(15);
    });
  });

  describe('validateOverride', () => {
    it('should reject invalid tier names', () => {
      const result = validateOverride('slay', 'invalid_tier');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid tier');
    });

    it('should reject when current tier is invalid', () => {
      const result = validateOverride('invalid', 'pass');
      expect(result.valid).toBe(false);
    });

    it('should reject when no change is requested (same tier)', () => {
      const result = validateOverride('pass', 'pass');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No change');
    });

    it('should allow tier upgrade', () => {
      const result = validateOverride('fail', 'pass');
      expect(result.valid).toBe(true);
      expect(result.tier_from).toBe('fail');
      expect(result.tier_to).toBe('pass');
    });

    it('should allow tier downgrade (intentional failure)', () => {
      const result = validateOverride('slay', 'fail');
      expect(result.valid).toBe(true);
      expect(result.tier_from).toBe('slay');
      expect(result.tier_to).toBe('fail');
    });

    it('should allow multi-tier upgrade', () => {
      const result = validateOverride('fail', 'slay');
      expect(result.valid).toBe(true);
    });
  });

  describe('computeStatDeltas', () => {
    it('should award correct coins for slay tier', () => {
      const evaluation = { tier_final: 'slay' };
      const deltas = computeStatDeltas(evaluation, {});
      expect(deltas.coins).toBe(150);
    });

    it('should award correct coins for pass tier', () => {
      const evaluation = { tier_final: 'pass' };
      const deltas = computeStatDeltas(evaluation, {});
      expect(deltas.coins).toBe(75);
    });

    it('should award correct coins for safe tier', () => {
      const evaluation = { tier_final: 'safe' };
      const deltas = computeStatDeltas(evaluation, {});
      expect(deltas.coins).toBe(25);
    });

    it('should penalise coins for fail tier', () => {
      const evaluation = { tier_final: 'fail' };
      const deltas = computeStatDeltas(evaluation, {});
      expect(deltas.coins).toBe(-25);
    });

    it('should deduct event cost from coins', () => {
      const evaluation = { tier_final: 'slay' };
      const deltas = computeStatDeltas(evaluation, { cost: 50 });
      // 150 (slay reward) - 50 (cost) + 50 (paid event slay bonus) = 150
      expect(deltas.coins).toBe(150);
    });

    it('should give paid event bonus for slay on paid events', () => {
      const evaluation = { tier_final: 'slay' };
      const deltas = computeStatDeltas(evaluation, { cost: 100 });
      // 150 - 100 (cost) + 50 (paid slay bonus) = 100
      expect(deltas.coins).toBe(100);
    });

    it('should apply stat deltas for slay', () => {
      const deltas = computeStatDeltas({ tier_final: 'slay' }, {});
      expect(deltas.reputation).toBe(2);
      expect(deltas.brand_trust).toBe(1);
      expect(deltas.influence).toBe(1);
      expect(deltas.stress).toBe(-1);
    });

    it('should apply stat deltas for fail', () => {
      const deltas = computeStatDeltas({ tier_final: 'fail' }, {});
      expect(deltas.reputation).toBe(-2);
      expect(deltas.brand_trust).toBe(-1);
      expect(deltas.influence).toBe(-1);
      expect(deltas.stress).toBe(2);
    });

    it('should apply override costs', () => {
      const evaluation = { tier_final: 'pass' };
      const overrides = [{ costs: { coins: -25 } }];
      const deltas = computeStatDeltas(evaluation, {}, overrides);
      expect(deltas.coins).toBe(75 - 25);
    });

    it('should apply override impacts', () => {
      const evaluation = { tier_final: 'pass' };
      const overrides = [{ impact: { reputation: 1 } }];
      const deltas = computeStatDeltas(evaluation, {}, overrides);
      expect(deltas.reputation).toBe(2); // 1 (pass base) + 1 (override)
    });
  });

  describe('applyDeltas', () => {
    it('should add coin delta to existing coins', () => {
      const state = { coins: 500 };
      const newState = applyDeltas(state, { coins: 150 });
      expect(newState.coins).toBe(650);
    });

    it('should allow coins to go negative but floor at -9999', () => {
      const state = { coins: -9990 };
      const newState = applyDeltas(state, { coins: -20 });
      expect(newState.coins).toBe(-9999);
    });

    it('should increase stats with full delta at low level (0-4)', () => {
      const state = { reputation: 2 };
      const newState = applyDeltas(state, { reputation: 2 });
      expect(newState.reputation).toBe(4);
    });

    it('should apply halved delta at mid level (5-7)', () => {
      const state = { reputation: 5 };
      // delta 2, halved = 1, ceiling = 1
      const newState = applyDeltas(state, { reputation: 2 });
      expect(newState.reputation).toBe(6);
    });

    it('should apply quarter delta at near-cap level (8-9)', () => {
      const state = { reputation: 8 };
      // delta 4, quarter = 1 (ceiling), so +1
      const newState = applyDeltas(state, { reputation: 4 });
      expect(newState.reputation).toBe(9);
    });

    it('should give no gain at stat cap (10)', () => {
      const state = { reputation: 10 };
      const newState = applyDeltas(state, { reputation: 5 });
      expect(newState.reputation).toBe(10);
    });

    it('should apply full stress penalty regardless of stress level', () => {
      const state = { stress: 8 };
      const newState = applyDeltas(state, { stress: 2 });
      // stress is excluded from diminishing returns
      expect(newState.stress).toBe(10);
    });

    it('should clamp stats at 0 when reduced', () => {
      const state = { reputation: 1 };
      const newState = applyDeltas(state, { reputation: -5 });
      expect(newState.reputation).toBe(0);
    });

    it('should not mutate original state', () => {
      const state = { coins: 500, reputation: 3 };
      applyDeltas(state, { coins: 100, reputation: 1 });
      expect(state.coins).toBe(500);
      expect(state.reputation).toBe(3);
    });
  });

  describe('generateNarrativeLine', () => {
    it('should return short, dramatic, and comedic lines for slay', () => {
      const result = generateNarrativeLine({ tier_final: 'slay', score: 90, breakdown: {} });
      expect(result).toHaveProperty('short');
      expect(result).toHaveProperty('dramatic');
      expect(result).toHaveProperty('comedic');
      expect(result.short).toContain('90');
    });

    it('should return lines for pass tier', () => {
      const result = generateNarrativeLine({ tier_final: 'pass', score: 70, breakdown: {} });
      expect(result.short).toContain('70');
    });

    it('should return lines for safe tier', () => {
      const result = generateNarrativeLine({ tier_final: 'safe', score: 55, breakdown: {} });
      expect(result.short).toContain('55');
    });

    it('should return lines for fail tier', () => {
      const result = generateNarrativeLine({ tier_final: 'fail', score: 30, breakdown: {} });
      expect(result.short).toContain('30');
    });

    it('should fall back to safe lines for unknown tier', () => {
      const result = generateNarrativeLine({ tier_final: 'unknown', score: 50, breakdown: {} });
      expect(result).toHaveProperty('short');
    });
  });
});
