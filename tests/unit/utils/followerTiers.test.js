/**
 * The stored follower tier as the six count tiers (Task #3106; Evoni,
 * 2026-10-13): the keys are pulseAudience's; follow odds for Emerging and
 * Nano copy a character's Micro; prestige and starting counts cover all six,
 * the four older tiers unchanged; the registry keeps ghost and unknown, which
 * never reach a Feed profile.
 */
const { FOLLOWER_TIER_KEYS, DEFAULT_TIER_AFFINITY, withSixTiers } = require('../../../src/utils/followerTiers');
const { TIERS } = require('../../../src/services/pulseAudience');

describe('follower tiers', () => {
  it('are the six count tiers, smallest first', () => {
    expect(FOLLOWER_TIER_KEYS).toEqual(TIERS.map((t) => t.key));
    expect(FOLLOWER_TIER_KEYS).toEqual(['emerging', 'nano', 'micro', 'mid', 'macro', 'mega']);
    expect(Object.keys(DEFAULT_TIER_AFFINITY).sort()).toEqual([...FOLLOWER_TIER_KEYS].sort());
  });

  it('withSixTiers fills Emerging and Nano from the Micro value, keeping what is set', () => {
    expect(withSixTiers({ micro: 0.8, mid: 0.7 })).toEqual({ micro: 0.8, mid: 0.7, emerging: 0.8, nano: 0.8 });
    expect(withSixTiers({ micro: 0.8, nano: 0.4 })).toEqual({ micro: 0.8, nano: 0.4, emerging: 0.8 });
    expect(withSixTiers({ mid: 0.7 })).toEqual({ mid: 0.7 });
    expect(withSixTiers(null)).toEqual({});
  });

  it('prestige ranges cover all six; the four older ones are unchanged', () => {
    const { TIER_PRESTIGE } = require('../../../src/services/eventAutomationService');
    expect(TIER_PRESTIGE).toEqual({
      mega: { min: 6, max: 10 }, macro: { min: 4, max: 8 }, mid: { min: 2, max: 6 }, micro: { min: 1, max: 4 },
      nano: { min: 1, max: 3 }, emerging: { min: 1, max: 2 },
    });
  });

  it("a registry edit copies a six-tier value onto the Feed profile, never ghost or unknown", async () => {
    const registrySync = require('../../../src/services/registrySync');
    const update = jest.fn().mockResolvedValue([1]);
    const models = {
      RegistryCharacter: { findByPk: jest.fn().mockResolvedValue({ feed_profile_id: 7 }) },
      SocialProfile: { update },
    };
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await registrySync.syncFeedProfileFromRegistry('c1', { follower_tier: 'nano' }, models);
    expect(update).toHaveBeenCalledWith({ follower_tier: 'nano' }, { where: { id: 7 } });
    update.mockClear();
    for (const tier of ['ghost', 'unknown']) await registrySync.syncFeedProfileFromRegistry('c1', { follower_tier: tier }, models);
    expect(update).not.toHaveBeenCalled();
    await registrySync.syncFeedProfileFromRegistry('c1', { follower_tier: 'ghost', current_state: 'quiet' }, models);
    expect(update).toHaveBeenCalledWith({ current_state: 'quiet' }, { where: { id: 7 } });
  });
});
