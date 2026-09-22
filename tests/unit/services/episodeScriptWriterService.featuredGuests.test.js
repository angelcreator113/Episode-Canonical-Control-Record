/**
 * episodeScriptWriterService — loadScriptContext's featured-attendee
 * filtering for the script prompt (Task #1693).
 *
 * docs/EVENT_EPISODE_FLOW.md §8(q) ruling 3: featured attendees are a
 * narrower, curated subset of guest_profiles. When any guest is marked
 * featured, only featured guests (with their story_role) go into the
 * script's CHARACTERS AT THE EVENT prompt block, and the rest are
 * counted but not named. An event with no featured guests keeps
 * today's behavior — every guest, unfiltered.
 */

const { loadScriptContext } = require('../../../src/services/episodeScriptWriterService');

function makeSocialProfileRows() {
  return [
    { id: 'host1', handle: 'host-handle', display_name: 'Host One', creator_name: null, platform: 'instagram', archetype: 'host', posting_voice: null, content_persona: null, lala_relevance_score: null, celebrity_tier: null, follow_motivation: null, follow_emotion: null, registry_character_id: null, char_name: null, core_belief: null, pressure_type: null, pressure_quote: null, role_type: null, role_label: null, appearance_mode: null, depth_level: null, personality: null, char_description: null, core_wound: null, core_desire: null, core_fear: null, mask_persona: null, truth_persona: null, character_archetype: null, therapy_primary_defense: null, therapy_emotional_state: null, signature_trait: null, emotional_baseline: null },
    { id: 'g1', handle: 'guest-one', display_name: 'Guest One', creator_name: null, platform: 'instagram', archetype: 'friend', posting_voice: null, content_persona: null, lala_relevance_score: null, celebrity_tier: null, follow_motivation: null, follow_emotion: null, registry_character_id: null, char_name: null, core_belief: null, pressure_type: null, pressure_quote: null, role_type: null, role_label: null, appearance_mode: null, depth_level: null, personality: null, char_description: null, core_wound: null, core_desire: null, core_fear: null, mask_persona: null, truth_persona: null, character_archetype: null, therapy_primary_defense: null, therapy_emotional_state: null, signature_trait: null, emotional_baseline: null },
    { id: 'g2', handle: 'guest-two', display_name: 'Guest Two', creator_name: null, platform: 'instagram', archetype: 'tension', posting_voice: null, content_persona: null, lala_relevance_score: null, celebrity_tier: null, follow_motivation: null, follow_emotion: null, registry_character_id: null, char_name: null, core_belief: null, pressure_type: null, pressure_quote: null, role_type: null, role_label: null, appearance_mode: null, depth_level: null, personality: null, char_description: null, core_wound: null, core_desire: null, core_fear: null, mask_persona: null, truth_persona: null, character_archetype: null, therapy_primary_defense: null, therapy_emotional_state: null, signature_trait: null, emotional_baseline: null },
    { id: 'g3', handle: 'guest-three', display_name: 'Guest Three', creator_name: null, platform: 'instagram', archetype: 'wildcard', posting_voice: null, content_persona: null, lala_relevance_score: null, celebrity_tier: null, follow_motivation: null, follow_emotion: null, registry_character_id: null, char_name: null, core_belief: null, pressure_type: null, pressure_quote: null, role_type: null, role_label: null, appearance_mode: null, depth_level: null, personality: null, char_description: null, core_wound: null, core_desire: null, core_fear: null, mask_persona: null, truth_persona: null, character_archetype: null, therapy_primary_defense: null, therapy_emotional_state: null, signature_trait: null, emotional_baseline: null },
  ];
}

function makeSequelize(socialProfileRows) {
  const QueryTypes = { SELECT: 'SELECT' };
  return {
    QueryTypes,
    query: jest.fn(async (sql, options = {}) => {
      if (/FROM social_profiles/.test(sql)) {
        const ids = options.replacements.ids;
        return [socialProfileRows.filter(r => ids.includes(r.id))];
      }
      if (options.type === QueryTypes.SELECT) return [];
      return [[]];
    }),
  };
}

function makeModels(event, socialProfileRows) {
  return {
    EpisodeBrief: { findOne: async () => null },
    ScenePlan: { findAll: async () => [] },
    SceneSet: {},
    SceneAngle: {},
    FranchiseKnowledge: null,
    WorldEvent: {
      CURRENT_ATTRIBUTES: ['id', 'name', 'canon_consequences'],
      findOne: async () => ({ toJSON: () => event }),
    },
    WorldLocation: null,
    Opportunity: null,
    Episode: { findByPk: async () => null },
    sequelize: makeSequelize(socialProfileRows),
  };
}

function makeEvent(guestProfiles) {
  return {
    id: 'event-1',
    name: 'Test Gala',
    canon_consequences: {
      automation: {
        host_profile_id: 'host1',
        guest_profiles: guestProfiles,
      },
    },
  };
}

describe('loadScriptContext — featured attendees in the script prompt', () => {
  it('passes only featured guests, each with its story role, when any guest is featured', async () => {
    const event = makeEvent([
      { profile_id: 'g1', handle: 'guest-one', display_name: 'Guest One', featured: true, story_role: 'friend' },
      { profile_id: 'g2', handle: 'guest-two', display_name: 'Guest Two', featured: true, story_role: null },
      { profile_id: 'g3', handle: 'guest-three', display_name: 'Guest Three', featured: false, story_role: null },
    ]);
    const models = makeModels(event, makeSocialProfileRows());

    const context = await loadScriptContext('ep-1', 'show-1', models);

    const ids = context.socialProfiles.map(p => p.id);
    expect(ids).toEqual(['host1', 'g1', 'g2']);
    expect(context.unfeaturedGuestCount).toBe(1);
  });

  it('passes a guest without a story role without one', async () => {
    const event = makeEvent([
      { profile_id: 'g1', handle: 'guest-one', display_name: 'Guest One', featured: true, story_role: 'friend' },
      { profile_id: 'g2', handle: 'guest-two', display_name: 'Guest Two', featured: true, story_role: null },
    ]);
    const models = makeModels(event, makeSocialProfileRows());

    const context = await loadScriptContext('ep-1', 'show-1', models);

    const g1 = context.socialProfiles.find(p => p.id === 'g1');
    const g2 = context.socialProfiles.find(p => p.id === 'g2');
    expect(g1.story_role).toBe('friend');
    expect(g2.story_role).toBeNull();
  });

  it('passes every guest unchanged when none is featured', async () => {
    const event = makeEvent([
      { profile_id: 'g1', handle: 'guest-one', display_name: 'Guest One' },
      { profile_id: 'g2', handle: 'guest-two', display_name: 'Guest Two' },
      { profile_id: 'g3', handle: 'guest-three', display_name: 'Guest Three' },
    ]);
    const models = makeModels(event, makeSocialProfileRows());

    const context = await loadScriptContext('ep-1', 'show-1', models);

    const ids = context.socialProfiles.map(p => p.id);
    expect(ids).toEqual(['host1', 'g1', 'g2', 'g3']);
    expect(context.unfeaturedGuestCount).toBe(0);
    expect(context.socialProfiles.every(p => p.story_role === null)).toBe(true);
  });
});
