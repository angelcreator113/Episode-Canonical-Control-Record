/**
 * assembleGuestList — guest selection (Task #1796). Mocked models, no database.
 *
 * The fill stage used to score only the first `remaining` candidates of a
 * pool already ordered by lala_relevance_score DESC and keep all of them,
 * filling usedArchetypes/usedTiers only after choosing: no score ever
 * changed who was picked. It now picks one guest at a time from the whole
 * pool, rescoring after each pick, with ties going to the earlier
 * candidate. The relationship stage now applies the same two filters the
 * fill stage does: never JustAWoman, never a real-world profile.
 */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { assembleGuestList, scoreGuestCandidate } = require('../../../src/services/eventAutomationService');

const HOST = { id: 1, handle: 'host' };
const FASHION = { cultural_category: 'fashion' };

// A pool row with neutral defaults: no category match, no Lala relationship.
let nextId = 100;
const cand = (over = {}) => ({
  id: nextId++, handle: `h${nextId}`, display_name: `P${nextId}`,
  content_category: 'gaming', archetype: 'the_peer', follower_tier: 'micro', lala_relationship: null,
  ...over,
});

function makeModels({ pool = [], relationships = [], related = [] } = {}) {
  const calls = { related: [], pool: [] };
  const SocialProfile = {
    findAll: jest.fn(async (opts) => {
      if (opts.where?.id?.[Op.in]) { calls.related.push(opts); return related; }
      calls.pool.push(opts);
      return pool;
    }),
  };
  const SocialProfileRelationship = { findAll: jest.fn(async () => relationships) };
  return { models: { SocialProfile, SocialProfileRelationship }, calls };
}

const pick = async (pool, maxGuests, calendarEvent = FASHION) => {
  const { models } = makeModels({ pool });
  const guests = await assembleGuestList(HOST, calendarEvent, models, maxGuests);
  return guests.map(g => g.handle);
};

describe('fill stage — every score now changes who is chosen', () => {
  test('category match: a matching candidate beats a higher-relevance one that does not match', async () => {
    const top = cand({ handle: 'top-relevance' });
    const match = cand({ handle: 'fashion-match', content_category: 'fashion' });
    expect(await pick([top, match], 1)).toEqual(['fashion-match']);
  });

  test('Lala relationship: direct beats a higher-relevance stranger', async () => {
    const top = cand({ handle: 'stranger' });
    const direct = cand({ handle: 'direct', lala_relationship: 'direct' });
    expect(await pick([top, direct], 1)).toEqual(['direct']);
  });

  test('relationship strength orders direct > competitive > aware > none', async () => {
    const pool = [cand({ handle: 'none' }), cand({ handle: 'aware', lala_relationship: 'aware' }),
      cand({ handle: 'competitive', lala_relationship: 'competitive' }), cand({ handle: 'direct', lala_relationship: 'direct' })];
    expect(await pick(pool, 4)).toEqual(['direct', 'competitive', 'aware', 'none']);
  });

  test('archetype diversity: with a shared archetype, the second pick prefers a new one', async () => {
    const pool = [
      cand({ handle: 'curator-1', archetype: 'polished_curator', follower_tier: 'micro' }),
      cand({ handle: 'curator-2', archetype: 'polished_curator', follower_tier: 'macro' }),
      cand({ handle: 'rise-1', archetype: 'overnight_rise', follower_tier: 'micro' }),
    ];
    // Before: the top two by relevance, both curators.
    expect(await pick(pool, 2)).toEqual(['curator-1', 'rise-1']);
  });

  test('tier diversity: between two of the same new archetype, the new tier wins', async () => {
    const pool = [
      cand({ handle: 'first', archetype: 'the_peer', follower_tier: 'micro' }),
      cand({ handle: 'same-tier', archetype: 'soft_life', follower_tier: 'micro' }),
      cand({ handle: 'new-tier', archetype: 'soft_life', follower_tier: 'mega' }),
    ];
    expect(await pick(pool, 2)).toEqual(['first', 'new-tier']);
  });

  test('the scorer: +20 category, +15/+12/+8 relationship, +10 new archetype, +8 new tier', () => {
    const none = new Set();
    expect(scoreGuestCandidate(cand({ content_category: 'fashion' }), ['fashion'], none, none)).toBe(20 + 10 + 8);
    expect(scoreGuestCandidate(cand({ lala_relationship: 'direct' }), [], none, none)).toBe(15 + 10 + 8);
    expect(scoreGuestCandidate(cand({ lala_relationship: 'competitive' }), [], none, none)).toBe(12 + 18);
    expect(scoreGuestCandidate(cand({ lala_relationship: 'aware' }), [], none, none)).toBe(8 + 18);
    expect(scoreGuestCandidate(cand({ archetype: 'a', follower_tier: 't' }), [], new Set(['a']), new Set(['t']))).toBe(0);
  });
});

describe('determinism', () => {
  test('a fixed pool always gives the same list; ties go to the earlier candidate', async () => {
    const pool = Array.from({ length: 12 }, (_, i) => cand({ handle: `c${i}`, archetype: `a${i % 3}`, follower_tier: `t${i % 2}` }));
    const first = await pick(pool, 6);
    for (let i = 0; i < 5; i++) expect(await pick(pool, 6)).toEqual(first);
    // Equal scores throughout the first round: the earliest candidate goes first.
    expect(first[0]).toBe('c0');
  });

  test('the pool query breaks relevance ties by id', async () => {
    const { models, calls } = makeModels({ pool: [] });
    await assembleGuestList(HOST, FASHION, models, 6);
    expect(calls.pool[0].order).toEqual([['lala_relevance_score', 'DESC'], ['id', 'ASC']]);
  });
});

describe('both callers keep their contract: shape and count', () => {
  const bigPool = () => Array.from({ length: 24 }, (_, i) => cand({ handle: `g${i}`, archetype: `a${i % 5}`, follower_tier: `t${i % 3}`, content_category: i % 2 ? 'fashion' : 'music' }));

  test.each([
    ['from-profile', 6],
    ['spawnEventsFromCalendar (default maxGuests)', 8],
  ])('%s: %i fill guests, each { profile_id, handle, display_name, relationship, archetype, follower_tier }', async (_label, max) => {
    const { models } = makeModels({ pool: bigPool() });
    const guests = await assembleGuestList(HOST, FASHION, models, max);
    expect(guests).toHaveLength(max);
    for (const g of guests) {
      expect(Object.keys(g).sort()).toEqual(['archetype', 'display_name', 'follower_tier', 'handle', 'profile_id', 'relationship']);
      expect(['industry', 'scene']).toContain(g.relationship);
    }
    expect(new Set(guests.map(g => g.profile_id)).size).toBe(max);
  });

  test('the callers still pass what they passed: from-profile 6, the calendar path maxGuests (default 8)', () => {
    const root = path.join(__dirname, '../../..');
    const route = fs.readFileSync(path.join(root, 'src/routes/worldEvents.js'), 'utf8');
    const svc = fs.readFileSync(path.join(root, 'src/services/eventAutomationService.js'), 'utf8');
    expect(route).toMatch(/assembleGuestList\(profile, fakeCalEvent, models, 6\)/);
    expect(svc).toMatch(/const \{ eventCount = 1, maxGuests = 8 \} = options;/);
    expect(svc).toMatch(/assembleGuestList\(host, calendarEvent, models, maxGuests\)/);
  });

  test('a small pool gives fewer guests, never duplicates', async () => {
    const pool = [cand({ handle: 'only-1' }), cand({ handle: 'only-2' })];
    expect(await pick(pool, 6)).toEqual(['only-1', 'only-2']);
  });
});

describe('relationship stage — the same two filters as the fill stage', () => {
  const rel = (b, type = 'friend') => ({ profile_a_id: HOST.id, profile_b_id: b, relationship_type: type });

  test('the related-profile lookup excludes JustAWoman and real-world profiles', async () => {
    const { models, calls } = makeModels({ relationships: [rel(7)], related: [] });
    await assembleGuestList(HOST, FASHION, models, 6);
    const where = calls.related[0].where;
    expect(where.feed_layer).toBe('lalaverse');
    expect(where.is_justawoman_record).toEqual({ [Op.ne]: true });
    expect(where.id[Op.in]).toEqual([7]);
  });

  test('the fill stage applies the same two filters (unchanged)', async () => {
    const { models, calls } = makeModels({ pool: [] });
    await assembleGuestList(HOST, FASHION, models, 6);
    expect(calls.pool[0].where.feed_layer).toBe('lalaverse');
    expect(calls.pool[0].where.is_justawoman_record).toEqual({ [Op.ne]: true });
  });

  test('a related profile filtered out leaves its slot to the fill stage', async () => {
    // Two relationships; the lookup (with the filters) returns only one.
    const kept = { id: 7, handle: 'kept-friend', display_name: 'Kept' };
    const pool = Array.from({ length: 10 }, (_, i) => cand({ handle: `fill${i}`, archetype: `a${i}` }));
    const { models } = makeModels({ relationships: [rel(7), rel(8, 'rival')], related: [kept], pool });
    const guests = await assembleGuestList(HOST, FASHION, models, 6);
    expect(guests).toHaveLength(6);
    expect(guests[0]).toEqual({ profile_id: 7, handle: 'kept-friend', display_name: 'Kept', relationship: 'friend' });
    expect(guests.slice(1).every(g => g.handle.startsWith('fill'))).toBe(true);
  });
});
