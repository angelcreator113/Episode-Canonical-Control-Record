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
 */

const { scheduleOpportunityAsEvent } = require('../../../src/services/feedEventPipelineService');

function makeModels({ opportunity, guests = [] } = {}) {
  const queries = [];
  return {
    queries,
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
          if (/FROM social_profiles/.test(sql)) {
            return [guests];
          }
          if (/INSERT INTO world_events/.test(sql)) {
            return [[]];
          }
          if (/UPDATE opportunities SET event_id/.test(sql)) {
            return [[]];
          }
          throw new Error(`Unexpected query in test: ${sql}`);
        }),
      },
    },
  };
}

describe('scheduleOpportunityAsEvent', () => {
  // generateUniqueVenue only calls the Anthropic API when this is set —
  // force it unset so the test never depends on network access.
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => {
    if (originalApiKey !== undefined) process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('runs to completion and produces a guest with profile_id — impossible before this fix', async () => {
    const opportunity = {
      id: 'opp-1',
      show_id: 'show-1',
      name: 'Test Opportunity Event',
      event_id: null,
      opportunity_type: 'social_event',
      connector_profile_id: 'host-profile-1',
      connector_handle: 'thehost',
      brand_or_company: null,
      prestige: 6,
      wardrobe_brief: null,
      narrative_stakes: null,
      what_could_go_wrong: null,
      career_milestone: null,
    };
    const guestRow = {
      id: 'guest-profile-1', handle: 'guestone', display_name: 'Guest One',
      platform: 'instagram', follower_tier: 'mid',
    };

    const { models, queries } = makeModels({ opportunity, guests: [guestRow] });

    const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);

    expect(result.event_id).toBeTruthy();
    expect(result.guests).toBe(1);

    const automation = JSON.parse(result.event_data.canon_consequences).automation;
    expect(automation.guest_profiles).toEqual([
      { profile_id: 'guest-profile-1', handle: 'guestone', display_name: 'Guest One' },
    ]);

    const inserts = queries.filter(q => /INSERT INTO world_events/.test(q.sql));
    expect(inserts).toHaveLength(1);
    const opportunityUpdates = queries.filter(q => /UPDATE opportunities SET event_id/.test(q.sql));
    expect(opportunityUpdates).toHaveLength(1);
  });

  // Task #1797: the guest query never picks JustAWoman (she is the host,
  // not an attendee) or a real-world profile for a LalaVerse event. Nothing
  // else about the query changes.
  describe('guest query filters (Task #1797)', () => {
    const opportunity = {
      id: 'opp-1', show_id: 'show-1', name: 'Filter Event', event_id: null,
      opportunity_type: 'social_event', connector_profile_id: 'host-profile-1',
      connector_handle: 'thehost', brand_or_company: null, prestige: 6,
      wardrobe_brief: null, narrative_stakes: null, what_could_go_wrong: null, career_milestone: null,
    };
    const guestQuery = async (guests = []) => {
      const { models, queries } = makeModels({ opportunity, guests });
      const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);
      const q = queries.filter(x => /FROM social_profiles/.test(x.sql));
      expect(q).toHaveLength(1);
      return { sql: q[0].sql.replace(/\s+/g, ' '), opts: q[0].opts, result };
    };

    it('excludes JustAWoman', async () => {
      const { sql } = await guestQuery();
      expect(sql).toMatch(/AND is_justawoman_record IS NOT TRUE/);
    });

    it('takes LalaVerse profiles only', async () => {
      const { sql } = await guestQuery();
      expect(sql).toMatch(/AND feed_layer = 'lalaverse'/);
    });

    it('keeps everything else: host excluded, statuses, minimum relevance, RANDOM() LIMIT 6', async () => {
      const { sql, opts } = await guestQuery();
      expect(sql).toMatch(/WHERE id != :hostId AND status IN \('generated', 'finalized', 'crossed'\)/);
      expect(sql).toMatch(/AND lala_relevance_score >= 3/);
      expect(sql).toMatch(/ORDER BY RANDOM\(\) LIMIT 6$/);
      expect(opts.replacements).toEqual({ hostId: 'host-profile-1' });
    });

    it('fewer eligible profiles means fewer guests, in the same shape', async () => {
      const rows = [
        { id: 'g1', handle: 'one', display_name: 'One', platform: 'instagram', follower_tier: 'mid' },
        { id: 'g2', handle: 'two', display_name: 'Two', platform: 'tiktok', follower_tier: 'micro' },
      ];
      const { result } = await guestQuery(rows);
      expect(result.guests).toBe(2);
      const automation = JSON.parse(result.event_data.canon_consequences).automation;
      expect(automation.guest_profiles).toEqual([
        { profile_id: 'g1', handle: 'one', display_name: 'One' },
        { profile_id: 'g2', handle: 'two', display_name: 'Two' },
      ]);
    });

    it('no connector profile: no guest query at all, as before', async () => {
      const { models, queries } = makeModels({ opportunity: { ...opportunity, connector_profile_id: null } });
      const result = await scheduleOpportunityAsEvent('opp-1', 'show-1', models);
      expect(queries.filter(x => /FROM social_profiles/.test(x.sql))).toHaveLength(0);
      expect(result.guests).toBe(0);
    });
  });
});
