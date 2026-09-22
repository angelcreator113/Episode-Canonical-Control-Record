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
});
