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
const { assembleGuestList, scoreGuestCandidate, guestEligibilityWhere } = require('../../../src/services/eventAutomationService');
const { strictSocialProfileRelationship, DECLARED, ENUMS } = require('../helpers/strictSocialProfileRelationship');

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
  // Task #1860: the fake knows the real model's columns and enums.
  const SocialProfileRelationship = strictSocialProfileRelationship(relationships);
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
  const rel = (b, type = 'bestie') => ({ source_profile_id: HOST.id, target_profile_id: b, relationship_type: type });

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
    expect(guests[0]).toEqual({ profile_id: 7, handle: 'kept-friend', display_name: 'Kept', relationship: 'bestie' });
    expect(guests.slice(1).every(g => g.handle.startsWith('fill'))).toBe(true);
  });
});

// Task #1800 — both stages apply the same eligibility rules, from
// guestEligibilityWhere: status, layer, JustAWoman, celebrity tier.
describe('eligibility — one set of rules for both stages', () => {
  const rel = (b, type = 'bestie') => ({ source_profile_id: HOST.id, target_profile_id: b, relationship_type: type });
  const SHARED = {
    status: { [Op.in]: ['finalized', 'generated', 'crossed'] },
    feed_layer: 'lalaverse',
    is_justawoman_record: { [Op.ne]: true },
    [Op.or]: [{ celebrity_tier: null }, { celebrity_tier: 'accessible' }, { celebrity_tier: 'selective' }],
  };

  test('guestEligibilityWhere holds the four rules, unchanged from guestWhere', () => {
    expect(guestEligibilityWhere(Op)).toEqual(SHARED);
  });

  test('the relationship stage carries every shared condition, plus its own id IN', async () => {
    const { models, calls } = makeModels({ relationships: [rel(7), rel(8)], related: [] });
    await assembleGuestList(HOST, FASHION, models, 6);
    const where = calls.related[0].where;
    expect(where).toEqual({ ...SHARED, id: { [Op.in]: [7, 8] } });
  });

  test('the fill stage carries every shared condition, plus its own id NOT IN', async () => {
    const { models, calls } = makeModels({ pool: [] });
    await assembleGuestList(HOST, FASHION, models, 6);
    expect(calls.pool[0].where).toEqual({ ...SHARED, id: { [Op.notIn]: [HOST.id] } });
  });

  // The database applies the where clause; this mock applies the same rules
  // to rows, so a draft, an archived and an untouchable related profile are
  // seen being left out and their slots going to the fill stage.
  test('a draft, an archived and an untouchable related profile are skipped; their slots are filled', async () => {
    const eligible = (p) => ['finalized', 'generated'].includes(p.status) && p.feed_layer === 'lalaverse'
      && p.is_justawoman_record !== true && [null, 'accessible', 'selective'].includes(p.celebrity_tier ?? null);
    const relatedRows = [
      { id: 7, handle: 'ok-friend', display_name: 'OK', status: 'finalized', feed_layer: 'lalaverse', celebrity_tier: 'accessible' },
      { id: 8, handle: 'draft-friend', display_name: 'Draft', status: 'draft', feed_layer: 'lalaverse', celebrity_tier: null },
      { id: 9, handle: 'archived-friend', display_name: 'Archived', status: 'archived', feed_layer: 'lalaverse', celebrity_tier: null },
      { id: 10, handle: 'untouchable-friend', display_name: 'Star', status: 'finalized', feed_layer: 'lalaverse', celebrity_tier: 'untouchable' },
    ];
    const pool = Array.from({ length: 10 }, (_, i) => cand({ handle: `fill${i}`, archetype: `a${i}` }));
    const SocialProfile = {
      findAll: jest.fn(async (opts) => {
        if (opts.where?.id?.[Op.in]) {
          expect(opts.where).toMatchObject({ status: SHARED.status, feed_layer: 'lalaverse' });
          return relatedRows.filter(eligible).map(({ id, handle, display_name }) => ({ id, handle, display_name }));
        }
        return pool;
      }),
    };
    const SocialProfileRelationship = strictSocialProfileRelationship([rel(7), rel(8), rel(9), rel(10)]);
    const guests = await assembleGuestList(HOST, FASHION, { SocialProfile, SocialProfileRelationship }, 6);
    expect(guests).toHaveLength(6);
    expect(guests.map(g => g.handle)).toEqual(['ok-friend', 'fill0', 'fill1', 'fill2', 'fill3', 'fill4']);
    expect(guests.map(g => g.handle)).not.toEqual(expect.arrayContaining(['draft-friend', 'archived-friend', 'untouchable-friend']));
  });

  test('a failed relationship lookup is logged, and the fill stage still runs', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = Array.from({ length: 8 }, (_, i) => cand({ handle: `fill${i}` }));
    const SocialProfile = { findAll: jest.fn(async (opts) => (opts.where?.id?.[Op.in] ? [] : pool)) };
    const SocialProfileRelationship = { findAll: jest.fn(async () => { throw new Error('relation "social_profile_relationships" does not exist'); }) };
    const guests = await assembleGuestList(HOST, FASHION, { SocialProfile, SocialProfileRelationship }, 6);
    expect(warn).toHaveBeenCalledWith('[EventAutomation] Relationship-stage guest lookup failed:', 'relation "social_profile_relationships" does not exist');
    expect(guests).toHaveLength(6);
    warn.mockRestore();
  });
});

// Task #1860 — the relationship stage queried profile_a_id / profile_b_id,
// which the table never had (production, 2026-09-25: "column
// SocialProfileRelationship.profile_a_id does not exist"). The mocks used
// the same wrong names, so the tests passed. This fake reads the declared
// names from the real model's rawAttributes and rejects anything else.
describe('relationship stage — queries the columns the model declares', () => {
  const HOST_ID = HOST.id;

  test('the strict fake knows the real columns, and not the old names', () => {
    expect(DECLARED.has('source_profile_id')).toBe(true);
    expect(DECLARED.has('target_profile_id')).toBe(true);
    expect(DECLARED.has('profile_a_id')).toBe(false);
    expect(DECLARED.has('profile_b_id')).toBe(false);
    expect(ENUMS.relationship_type).toContain('bestie');
    expect(ENUMS.relationship_type).not.toContain('friend');
  });

  test('the strict fake rejects an undeclared where key, attribute, fixture key or enum value', async () => {
    const fake = strictSocialProfileRelationship([]);
    await expect(fake.findAll({ where: { [Op.or]: [{ profile_a_id: 1 }] } })).rejects.toThrow('profile_a_id does not exist');
    await expect(fake.findAll({ attributes: ['profile_b_id'] })).rejects.toThrow('profile_b_id does not exist');
    await expect(strictSocialProfileRelationship([{ profile_a_id: 1 }]).findAll({})).rejects.toThrow('profile_a_id does not exist');
    await expect(strictSocialProfileRelationship([{ relationship_type: 'friend' }]).findAll({})).rejects.toThrow("'friend' is not in the model's enum");
  });

  test('host on either side: related guests come first, labelled by type, and nothing is logged', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const relationships = [
      { source_profile_id: HOST_ID, target_profile_id: 7, relationship_type: 'rival', direction: 'mutual' },
      // Host is the target and the relation points target to source: the
      // host mentors 8, so 8 is invited (Task #1866 rule 1). Until #1866
      // this fixture was 'source_to_target' — 8 mentoring the host, a
      // guest-to-host link that no longer invites.
      { source_profile_id: 8, target_profile_id: HOST_ID, relationship_type: 'mentor', direction: 'target_to_source' },
    ];
    const related = [
      { id: 7, handle: 'rival-7', display_name: 'Rival' },
      { id: 8, handle: 'mentor-8', display_name: 'Mentor' },
    ];
    const pool = Array.from({ length: 10 }, (_, i) => cand({ handle: `fill${i}`, archetype: `a${i}` }));
    const { models, calls } = makeModels({ relationships, related, pool });
    const guests = await assembleGuestList(HOST, FASHION, models, 6);

    expect(warn).not.toHaveBeenCalled();
    const relQuery = models.SocialProfileRelationship.findAll.mock.calls[0][0];
    // Task #1866 adds the secret_link and direction conditions, an id order
    // and no row limit.
    expect(relQuery.where).toEqual({ [Op.and]: [
      { [Op.or]: [{ source_profile_id: HOST_ID }, { target_profile_id: HOST_ID }] },
      { [Op.or]: [{ public_visibility: { [Op.ne]: 'hidden' } }, { public_visibility: null }] },
      { relationship_type: { [Op.ne]: 'secret_link' } },
      { [Op.or]: [
        { direction: 'mutual' },
        { direction: null },
        { source_profile_id: HOST_ID, direction: 'source_to_target' },
        { target_profile_id: HOST_ID, direction: 'target_to_source' },
      ] },
    ] });
    expect(relQuery.order).toEqual([['id', 'ASC']]);
    expect(relQuery).not.toHaveProperty('limit');
    expect(calls.related[0].where.id).toEqual({ [Op.in]: [7, 8] });
    expect(guests.slice(0, 2)).toEqual([
      { profile_id: 7, handle: 'rival-7', display_name: 'Rival', relationship: 'rival' },
      { profile_id: 8, handle: 'mentor-8', display_name: 'Mentor', relationship: 'mentor' },
    ]);
    expect(guests).toHaveLength(6);
    expect(calls.pool[0].where.id).toEqual({ [Op.notIn]: [HOST_ID, 7, 8] });
    warn.mockRestore();
  });
  test('a hidden relation never becomes an invitation (Task #1860 guard)', async () => {
    const relationships = [
      { source_profile_id: HOST_ID, target_profile_id: 7, relationship_type: 'secret_link', public_visibility: 'hidden' },
      { source_profile_id: HOST_ID, target_profile_id: 8, relationship_type: 'bestie', public_visibility: 'public' },
      { source_profile_id: 9, target_profile_id: HOST_ID, relationship_type: 'ex', public_visibility: 'rumored' },
    ];
    const related = [
      { id: 8, handle: 'bestie-8', display_name: 'Bestie' },
      { id: 9, handle: 'ex-9', display_name: 'Ex' },
    ];
    const { models, calls } = makeModels({ relationships, related });
    const guests = await assembleGuestList(HOST, FASHION, models, 6);

    expect(calls.related[0].where.id).toEqual({ [Op.in]: [8, 9] });
    expect(guests.map(g => g.profile_id)).not.toContain(7);
  });

  test('two relationship types to one person make one guest (Task #1860 guard)', async () => {
    const relationships = [
      { source_profile_id: HOST_ID, target_profile_id: 7, relationship_type: 'collab' },
      { source_profile_id: 7, target_profile_id: HOST_ID, relationship_type: 'rival' },
    ];
    const related = [{ id: 7, handle: 'both-7', display_name: 'Both' }];
    const { models, calls } = makeModels({ relationships, related });
    const guests = await assembleGuestList(HOST, FASHION, models, 6);

    expect(calls.related[0].where.id).toEqual({ [Op.in]: [7] });
    expect(guests.filter(g => g.profile_id === 7)).toEqual([
      { profile_id: 7, handle: 'both-7', display_name: 'Both', relationship: 'collab' },
    ]);
  });
});

// Task #1866 — Evoni's selection rules for the relationship stage (issue
// comment, 2026-09-25). One test per rule. The fakes here behave like the
// database: the relationship fake honours `limit` (as Postgres would), and
// the profile fake applies the eligibility rules to the ids asked for and
// returns them in reverse id order, so the stage's own order is what shows.
describe('relationship stage — selection rules (Task #1866)', () => {
  const HOST_ID = HOST.id;
  const r = (id, other, over = {}) => ({
    id, source_profile_id: HOST_ID, target_profile_id: other,
    relationship_type: 'bestie', direction: 'mutual', public_visibility: 'public', drama_level: 0, ...over,
  });
  // A key set to undefined is dropped, standing for a NULL column (the
  // strict fake rejects null as an enum value in a fixture).
  const omitUndefined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const person = (id, over = {}) => ({ id, handle: `p${id}`, display_name: `P${id}`, status: 'finalized', feed_layer: 'lalaverse', celebrity_tier: null, ...over });
  const eligible = (p) => ['finalized', 'generated', 'crossed'].includes(p.status) && p.feed_layer === 'lalaverse'
    && p.is_justawoman_record !== true && [null, 'accessible', 'selective'].includes(p.celebrity_tier ?? null);

  function world({ rows, people, pool = [] }) {
    const SocialProfile = {
      findAll: jest.fn(async (opts) => {
        const ids = opts.where?.id?.[Op.in];
        if (!ids) return pool;
        return people.filter(p => ids.includes(p.id) && eligible(p))
          .sort((a, b) => b.id - a.id)
          .map(({ id, handle, display_name }) => ({ id, handle, display_name }));
      }),
    };
    const SocialProfileRelationship = strictSocialProfileRelationship((opts) =>
      (opts.limit ? rows.slice(0, opts.limit) : rows));
    return { SocialProfile, SocialProfileRelationship };
  }
  const related = async (w, max = 6) => (await assembleGuestList(HOST, FASHION, w, max))
    .filter(g => !['industry', 'scene'].includes(g.relationship))
    .map(g => g.profile_id);
  // Rules 1, 4 and 5 are about who is invited, not the order (rule 2).
  const invited = async (w, max) => (await related(w, max)).sort((a, b) => a - b);

  test('rule 1 — direction gates: mutual, host-to-guest and NULL (the model default, mutual) invite; guest-to-host does not', async () => {
    const rows = [
      r(1, 11, { direction: 'mutual' }),
      r(2, 12, { direction: 'source_to_target' }),                                            // host → 12
      { ...r(3, 0), source_profile_id: 13, target_profile_id: HOST_ID, direction: 'target_to_source' }, // host → 13
      { ...r(4, 0), source_profile_id: 14, target_profile_id: HOST_ID, direction: 'source_to_target' }, // 14 → host
      r(5, 15, { direction: 'target_to_source' }),                                            // 15 → host
      omitUndefined(r(6, 16, { direction: undefined })),                                             // NULL
    ];
    const people = [11, 12, 13, 14, 15, 16].map(id => person(id));
    expect(await invited(world({ rows, people }))).toEqual([11, 12, 13, 16]);
  });

  test('rule 2 — ordered by id, not drama_level; the same data in any row order gives the same list', async () => {
    const rows = [
      r(30, 23, { drama_level: 10, relationship_type: 'feud' }),
      r(10, 21, { drama_level: 0 }),
      r(20, 22, { drama_level: 5, relationship_type: 'rival' }),
    ];
    const people = [21, 22, 23].map(id => person(id));
    const first = await related(world({ rows, people }), 2);
    expect(first).toEqual([21, 22]);
    expect(await related(world({ rows: [...rows].reverse(), people }), 2)).toEqual(first);
    const w = world({ rows, people });
    await related(w, 2);
    expect(w.SocialProfileRelationship.findAll.mock.calls[0][0].order).toEqual([['id', 'ASC']]);
  });

  test('rule 3 — eligibility applies before the limit: ineligible relations and a second relation to one person use no slot', async () => {
    const rows = [
      r(1, 31), r(2, 32), r(3, 31, { relationship_type: 'rival' }), r(4, 33), r(5, 34), r(6, 35),
    ];
    const people = [
      person(31, { status: 'draft' }), person(32, { celebrity_tier: 'untouchable' }),
      person(33), person(34), person(35),
    ];
    // Before #1866 the first two rows (maxGuests) were fetched, both
    // ineligible, and no related guest was chosen.
    expect(await related(world({ rows, people }), 2)).toEqual([33, 34]);
  });

  // Already true before #1866 (the #1860 guard excludes only 'hidden');
  // this pins it.
  test('rule 4 — a rumored relation invites, as public does; hidden still does not', async () => {
    const rows = [
      r(1, 41, { public_visibility: 'rumored' }),
      r(2, 42, { public_visibility: 'public' }),
      omitUndefined(r(3, 43, { public_visibility: undefined })),                                  // NULL
      r(4, 44, { public_visibility: 'hidden' }),
    ];
    const people = [41, 42, 43, 44].map(id => person(id));
    expect(await invited(world({ rows, people }))).toEqual([41, 42, 43]);
  });

  test('rule 5 — feud and ex invite; secret_link does not, whatever its visibility', async () => {
    const rows = [
      r(1, 51, { relationship_type: 'feud' }),
      r(2, 52, { relationship_type: 'ex', public_visibility: 'rumored' }),
      r(3, 53, { relationship_type: 'secret_link', public_visibility: 'public' }),
      r(4, 54, { relationship_type: 'secret_link', public_visibility: 'rumored' }),
    ];
    const people = [51, 52, 53, 54].map(id => person(id));
    const w = world({ rows, people });
    const guests = await assembleGuestList(HOST, FASHION, w, 6);
    expect(guests.filter(g => g.profile_id > 50).map(g => [g.profile_id, g.relationship])
      .sort((a, b) => a[0] - b[0])).toEqual([[51, 'feud'], [52, 'ex']]);
  });
});
