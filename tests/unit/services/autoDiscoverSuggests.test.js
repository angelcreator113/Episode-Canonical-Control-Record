/**
 * The Feed scheduler's auto-discover suggests instead of making
 * relationships (Evoni's decision b, 2026-10-17): its matches go to the
 * Relationship Map's Suggested pairs (services/pairSuggestions), and no
 * social_profile_relationships row is written.
 */
jest.mock('../../../src/services/pairSuggestions', () => ({
  addRulePairs: jest.fn(async (db, pairs) => pairs.map((p) => ({ key: `${Math.min(p.a, p.b)}-${Math.max(p.a, p.b)}`, type: p.type }))),
  pairKey: (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`,
}));

const pairs = require('../../../src/services/pairSuggestions');
const { autoDiscoverAgent } = require('../../../src/services/feedScheduler');

test('matches become suggestions; no relationship is created', async () => {
  const create = jest.fn();
  const profile = (id, handle) => ({ id, handle, platform: 'pulse', archetype: id === 1 ? 'soft_life' : 'explicitly_paid', content_category: 'skincare', geographic_cluster: 'velvet', follower_tier: 'micro', known_associates: [] });
  const db = {
    SocialProfile: { findAll: jest.fn().mockResolvedValue([profile(1, 'bea'), profile(2, 'tess')]) },
    SocialProfileRelationship: { findAll: jest.fn().mockResolvedValue([]), create },
  };
  const result = await autoDiscoverAgent(db);
  expect(create).not.toHaveBeenCalled();
  expect(pairs.addRulePairs).toHaveBeenCalledWith(db, [expect.objectContaining({ a: 1, b: 2, type: 'rival' })]);
  expect(result).toMatchObject({ agent: 'auto_discover', relationships_discovered: 0, pairs_suggested: 1 });
  expect(result.findings.map((f) => f.msg)).toContain('Suggested rival between @bea and @tess');
});
