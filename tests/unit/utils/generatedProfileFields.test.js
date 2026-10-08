/**
 * The fields a generated Feed profile saves (utils/generatedProfileFields),
 * shared by /generate and bulk import: the AI's values flattened for
 * querying, the ENUMs sanitized, the lists and objects defaulted.
 */
const { generatedProfileFields } = require('../../../src/utils/generatedProfileFields');

describe('generatedProfileFields', () => {
  it('flattens the AI\'s fields for querying, as /generate saves them', () => {
    const fields = generatedProfileFields({
      display_name: 'Nia Vale', creator_name: 'Nia', follower_tier: 'macro', content_category: 'beauty',
      archetype: 'soft_life', current_trajectory: 'pivoting', age_range: '25-34', geographic_base: 'Atlanta',
      platform_metrics: { avg_views: 12000 }, revenue_streams: ['brand deals'], world_exists: true,
    });
    expect(fields).toMatchObject({
      display_name: 'Nia Vale', creator_name: 'Nia', follower_tier: 'macro', content_category: 'beauty',
      archetype: 'soft_life', current_trajectory: 'pivoting', age_range: '25-34', geographic_base: 'Atlanta',
      platform_metrics: { avg_views: 12000 }, revenue_streams: ['brand deals'], world_exists: true,
    });
  });

  it('sanitizes the ENUMs, so an AI variation cannot fail the insert', () => {
    const fields = generatedProfileFields({ follower_tier: 'nano', archetype: 'influencer', current_trajectory: 'exploding' });
    expect(fields.follower_tier).toBe('mid');
    expect(fields.archetype).toBe('polished_curator');
    expect(fields.current_trajectory).toBe('rising');
  });

  it('defaults what the AI leaves out', () => {
    const fields = generatedProfileFields({});
    expect(fields).toMatchObject({
      creator_name: null, adult_content_present: false, lala_relevance_score: 0, world_exists: false,
      moment_log: [], sample_captions: [], sample_comments: [], book_relevance: [], known_associates: [],
      revenue_streams: [], brand_partnerships: [], controversy_history: [],
      platform_metrics: {}, audience_demographics: {}, aesthetic_dna: {},
    });
  });

  it('carries no identity, layer or Society field: each caller sets its own', () => {
    const fields = generatedProfileFields({ handle: '@x', platform: 'tiktok', city: 'echo_park', society_archetype: 'X', feed_layer: 'lalaverse' });
    for (const key of ['handle', 'platform', 'city', 'society_archetype', 'feed_layer', 'status', 'series_id', 'full_profile']) {
      expect(fields).not.toHaveProperty(key);
    }
  });
});
