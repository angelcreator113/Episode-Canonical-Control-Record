/**
 * feedEventPipelineService — scheduleOpportunityAsEvent runs to completion
 *
 * Task #1688, a follow-up commit to #1686: scheduleOpportunityAsEvent
 * referenced `prestige` in its generateUniqueVenue(...) call one line
 * before its own `const prestige = ...` declaration — a temporal-dead-zone
 * ReferenceError that threw on every call, before the function ever
 * reached the guest-mapping line #1686 fixed. The opportunity-pipeline
 * event-creation path could not create an event at all before this commit.
 * Found while working #1686; out of that issue's scope, fixed here as a
 * follow-up once Evoni asked for it.
 *
 * This is the first test that can exercise scheduleOpportunityAsEvent end
 * to end — any earlier attempt would have thrown before reaching any of
 * the assertions below.
 *
 * Task #1804: guests now come from the shared selection (assembleGuestList),
 * so the mocks provide SocialProfile / SocialProfileRelationship. The #1797
 * query-text tests are replaced by tests of the shared rules, which carry
 * the same JustAWoman and feed_layer filters.
 */

const { Op } = require('sequelize');
const { scheduleOpportunityAsEvent, opportunityGuestCategory } = require('../../../src/services/feedEventPipelineService');

// Since Task #1804 the pipeline takes its guests from assembleGuestList
// (models.SocialProfile / SocialProfileRelationship), not a raw query.
//
// Task #1814: the event also carries the opportunity's terms. The only new
// statement is INSERT INTO event_deliverables (when the opportunity has
// deliverables); `failDeliverables` makes it throw.
function makeModels({ opportunity, guests = [], relationships = [], related = [], failDeliverables = false } = {}) {
  const queries = [];
  const profileCalls = { related: [], pool: [] };
  return {
    queries,
    profileCalls,
    models: {
      sequelize: {
        query: jest.fn(async (sql, opts) => {
          queries.push({ sql, opts });
          if (/FROM opportunities WHERE id/.test(sql)) {
            return [[opportunity]];
          }
          if (/FROM world_events WHERE show_id/.test(sql)) {
            return [[]]; // no name collision
          }
          if (/INSERT INTO world_events/.test(sql)) {
            return [[]];
          }
          if (/INSERT INTO event_deliverables/.test(sql)) {
            if (failDeliverables) throw new Error('relation "event_deliverables" does not exist');
            return [[]];
          }
          if (/UPDATE opportunities SET event_id/.test(sql)) {
            return [[]];
          }
          throw new Error(`Unexpected query in test: ${sql}`);
        }),
      },
      SocialProfile: {
        findAll: jest.fn(async (opts) => {
          if (opts.where?.id?.[Op.in]) { profileCalls.related.push(opts); return related; }
          profileCalls.pool.push(opts);
          return guests;
        }),
      },
      SocialProfileRelationship: { findAll: jest.fn(async () => relationships) },
    },
  };
}

const baseOpportunity = () => ({
  id: 'opp-1',
  show_id: 'show-1',
  name: 'Test Opportunity Event',
  event_id: null,
  opportunity_type: 'social_event',
  category: null,
  connector_profile_id: 'host-profile-1',
  connector_handle: 'thehost',
  brand_or_company: null,
  prestige: 6,
  wardrobe_brief: null,
  narrative_stakes: null,
  what_could_go_wrong: null,
  career_milestone: null,
});

describe('scheduleOpportunityAsEvent', () => {
  // generateUniqueVenue only calls the Anthropic API when this is set —
  // force it unset so the test never depends on network access.
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => {
    if (originalApiKey !== undefined) process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('runs to completion and produces a guest with profile_id — impossible before #1688', async () => {
    const guestRow = {
      id: 'guest-profile-1', handle: 'guestone', display_name: 'Guest One',
      content_category: 'music', archetype: 'the_peer', follower_tier: 'mid', lala_relationship: null,
    };
    const { models, queries } = makeModels({ opportunity: baseOpportunity(), guests: [guestRow] });

    const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);

    expect(result.event_id).toBeTruthy();
    expect(result.guests).toBe(1);

    const automation = JSON.parse(result.event_data.canon_consequences).automation;
    // The shared selection's shape (Task #1804): relationship, archetype and
    // follower_tier now ride along with the #1686 keys.
    expect(automation.guest_profiles).toEqual([
      { profile_id: 'guest-profile-1', handle: 'guestone', display_name: 'Guest One', relationship: 'scene', archetype: 'the_peer', follower_tier: 'mid' },
    ]);

    const inserts = queries.filter(q => /INSERT INTO world_events/.test(q.sql));
    expect(inserts).toHaveLength(1);
    const opportunityUpdates = queries.filter(q => /UPDATE opportunities SET event_id/.test(q.sql));
    expect(opportunityUpdates).toHaveLength(1);
  });

  // Task #1804 — the pipeline uses the shared selection, per Evoni's rulings.
  describe('guests come from the shared selection (Task #1804)', () => {
    const cand = (id, over = {}) => ({
      id, handle: `h${id}`, display_name: `P${id}`, content_category: 'gaming',
      archetype: 'the_peer', follower_tier: 'micro', lala_relationship: null, ...over,
    });
    const run = async ({ opportunity = {}, ...rest } = {}) => {
      const made = makeModels({ ...rest, opportunity: { ...baseOpportunity(), ...opportunity } });
      const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', made.models);
      const automation = JSON.parse(result.event_data.canon_consequences).automation;
      return { ...made, result, guests: automation.guest_profiles };
    };

    it('no raw guest query any more: the pool query carries the shared rules, crossed included', async () => {
      const { queries, profileCalls } = await run({ guests: [cand(1)] });
      expect(queries.filter(q => /FROM social_profiles/.test(q.sql))).toHaveLength(0);
      const where = profileCalls.pool[0].where;
      expect(where.status).toEqual({ [Op.in]: ['finalized', 'generated', 'crossed'] });
      expect(where.feed_layer).toBe('lalaverse');
      expect(where.is_justawoman_record).toEqual({ [Op.ne]: true });
      expect(where[Op.or]).toEqual([{ celebrity_tier: null }, { celebrity_tier: 'accessible' }, { celebrity_tier: 'selective' }]);
      // No relevance floor (Evoni: dropped); the connector is excluded as host.
      expect(where).not.toHaveProperty('lala_relevance_score');
      expect(where.id).toEqual({ [Op.notIn]: ['host-profile-1'] });
    });

    it('the connector is the host: their circle is considered first', async () => {
      const friend = { id: 'friend-1', handle: 'friend', display_name: 'Friend' };
      const { guests, profileCalls } = await run({
        relationships: [{ profile_a_id: 'host-profile-1', profile_b_id: 'friend-1', relationship_type: 'friend' }],
        related: [friend],
        guests: [cand(1), cand(2, { archetype: 'soft_life' })],
      });
      expect(profileCalls.related[0].where.id).toEqual({ [Op.in]: ['friend-1'] });
      expect(guests[0]).toEqual({ profile_id: 'friend-1', handle: 'friend', display_name: 'Friend', relationship: 'friend' });
      expect(guests).toHaveLength(3);
    });

    it('six guests at most, chosen by score, the same list for the same pool', async () => {
      const pool = Array.from({ length: 12 }, (_, i) => cand(i + 1, { archetype: `a${i % 4}`, follower_tier: `t${i % 3}` }));
      const first = (await run({ guests: pool })).guests;
      const again = (await run({ guests: pool })).guests;
      expect(first).toHaveLength(6);
      expect(again).toEqual(first);
    });

    it('a known category scores; the relationship label follows it', async () => {
      const pool = [cand(1), cand(2, { content_category: 'beauty' })];
      const { guests } = await run({ opportunity: { category: 'beauty' }, guests: pool });
      expect(guests[0]).toMatchObject({ profile_id: 2, relationship: 'industry' });
    });

    it("'fashion' is no signal: a fashion candidate gets no category bonus", async () => {
      const pool = [cand(1), cand(2, { content_category: 'fashion' })];
      const { guests } = await run({ opportunity: { category: 'fashion' }, guests: pool });
      expect(guests.map(g => g.profile_id)).toEqual([1, 2]);
      expect(guests.every(g => g.relationship === 'scene')).toBe(true);
    });

    it('no connector: no guests, and no guest lookup at all (as before)', async () => {
      const { guests, profileCalls, result } = await run({ opportunity: { connector_profile_id: null }, guests: [cand(1)] });
      expect(guests).toEqual([]);
      expect(result.guests).toBe(0);
      expect(profileCalls.pool).toHaveLength(0);
      expect(profileCalls.related).toHaveLength(0);
    });

    it('a failed guest lookup is logged and the event is still created', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const made = makeModels({ opportunity: baseOpportunity() });
      made.models.SocialProfile.findAll = jest.fn(async () => { throw new Error('db down'); });
      const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', made.models);
      expect(result.event_id).toBeTruthy();
      expect(result.guests).toBe(0);
      expect(warn).toHaveBeenCalledWith('[FeedPipeline] Guest selection failed (event created without guests):', 'db down');
      warn.mockRestore();
    });
  });
});

describe('scheduleOpportunityAsEvent carries the opportunity terms (Task #1814)', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => {
    if (originalApiKey !== undefined) process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  const termsOpportunity = () => ({
    ...baseOpportunity(),
    connector_profile_id: null,
    deliverables: [
      { description: 'Sponsored content', completed: false },
      { type: 'story', description: 'Story mentions', due_date: '2026-11-07', completed: false },
    ],
    exclusivity: 'No competing beauty brands for 90 days',
    payment_amount: '1500.00',
  });

  it('deliverables become pending event_deliverables rows for the new event', async () => {
    const { models, queries } = makeModels({ opportunity: termsOpportunity() });
    const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);

    const inserts = queries.filter(q => /INSERT INTO event_deliverables/.test(q.sql));
    expect(inserts).toHaveLength(1);
    const r = inserts[0].opts.replacements;
    expect(r.event_id).toBe(result.event_id);
    expect(r).toMatchObject({
      description0: 'Sponsored content', type0: null, due0: null, required0: true,
      description1: 'Story mentions', type1: 'story', due1: '2026-11-07', required1: true,
    });
    expect(inserts[0].sql.match(/'pending'/g)).toHaveLength(2);
    expect(result.deliverables).toBe(2);

    // Written after the event exists (event_deliverables.event_id references it).
    const order = queries.map(q => q.sql);
    expect(order.findIndex(s => /INSERT INTO world_events/.test(s)))
      .toBeLessThan(order.findIndex(s => /INSERT INTO event_deliverables/.test(s)));
  });

  it('exclusivity becomes a restriction; payment becomes is_paid / payment_amount (rounded to the INTEGER column)', async () => {
    const { models, queries } = makeModels({ opportunity: { ...termsOpportunity(), payment_amount: '249.50' } });
    const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);

    const insert = queries.find(q => /INSERT INTO world_events/.test(q.sql));
    expect(insert.sql).toMatch(/restrictions, is_paid, payment_amount/);
    expect(insert.sql).toMatch(/:restrictions, :is_paid, :payment_amount/);
    expect(JSON.parse(insert.opts.replacements.restrictions))
      .toEqual([{ type: 'exclusivity', description: 'No competing beauty brands for 90 days' }]);
    expect(insert.opts.replacements.is_paid).toBe(true);
    expect(insert.opts.replacements.payment_amount).toBe(250);
    // Requirements are not touched: access requirements stay their own term.
    expect(insert.sql).not.toMatch(/requirements/);
    expect(result.event_data.requirements).toBeUndefined();
  });

  it('an opportunity with no terms: no deliverable insert, no restrictions, unpaid', async () => {
    const { models, queries } = makeModels({ opportunity: { ...baseOpportunity(), connector_profile_id: null } });
    const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);
    expect(queries.filter(q => /INSERT INTO event_deliverables/.test(q.sql))).toHaveLength(0);
    const insert = queries.find(q => /INSERT INTO world_events/.test(q.sql));
    expect(JSON.parse(insert.opts.replacements.restrictions)).toEqual([]);
    expect(insert.opts.replacements.is_paid).toBe(false);
    expect(insert.opts.replacements.payment_amount).toBe(0);
    expect(result.deliverables).toBe(0);
  });

  it('a failed deliverable insert is logged and the event is still created and booked', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { models, queries } = makeModels({ opportunity: termsOpportunity(), failDeliverables: true });
    const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);
    expect(result.event_id).toBeTruthy();
    expect(result.deliverables).toBe(0);
    expect(error).toHaveBeenCalledWith(
      '[FeedPipeline] Deliverable carry failed (event created without deliverables):',
      'relation "event_deliverables" does not exist'
    );
    expect(queries.filter(q => /UPDATE opportunities SET event_id/.test(q.sql))).toHaveLength(1);
    error.mockRestore();
  });
});

describe('opportunityGuestCategory (Task #1804)', () => {
  it("'fashion' and empty are no signal; anything else passes through", () => {
    expect(opportunityGuestCategory('fashion')).toBeNull();
    expect(opportunityGuestCategory(null)).toBeNull();
    expect(opportunityGuestCategory('')).toBeNull();
    expect(opportunityGuestCategory('beauty')).toBe('beauty');
    expect(opportunityGuestCategory('tech')).toBe('tech');
    expect(opportunityGuestCategory('lifestyle')).toBe('lifestyle');
  });
});
