'use strict';

/**
 * The fields a generated Feed profile saves, flattened for querying, from
 * the JSON socialProfileRoutes' buildGenerationPrompt asks the AI for. The
 * ENUMs are sanitized so an AI variation cannot fail the insert.
 *
 * /generate and bulk import both build from that prompt and both save
 * these. Bulk import kept its own shorter list and left out about twenty
 * of them (content_category, follower_tier, age_range, geographic_base,
 * platform_metrics, revenue_streams, ...), which reached only full_profile,
 * so a bulk-made creator fell out of the Feed's category filter.
 */

const {
  VALID_ARCHETYPES, VALID_TRAJECTORIES, VALID_FOLLOWER_TIERS, sanitizeEnum,
} = require('./fitToModel');

function generatedProfileFields(generated = {}) {
  return {
    display_name:          generated.display_name,
    creator_name:          generated.creator_name || null,
    follower_tier:         sanitizeEnum(generated.follower_tier, VALID_FOLLOWER_TIERS, 'mid'),
    follower_count_approx: generated.follower_count_approx,
    content_category:      generated.content_category,
    archetype:             sanitizeEnum(generated.archetype, VALID_ARCHETYPES, 'polished_curator'),
    content_persona:       generated.content_persona,
    real_signal:           generated.real_signal,
    posting_voice:         generated.posting_voice,
    comment_energy:        generated.comment_energy,
    adult_content_present: generated.adult_content_present || false,
    adult_content_type:    generated.adult_content_type,
    adult_content_framing: generated.adult_content_framing,
    parasocial_function:   generated.parasocial_function,
    emotional_activation:  generated.emotional_activation,
    watch_reason:          generated.watch_reason,
    what_it_costs_her:     generated.what_it_costs_her,
    current_trajectory:    sanitizeEnum(generated.current_trajectory, VALID_TRAJECTORIES, 'rising'),
    trajectory_detail:     generated.trajectory_detail,
    moment_log:            generated.moment_log || [],
    sample_captions:       generated.sample_captions || [],
    sample_comments:       generated.sample_comments || [],
    pinned_post:           generated.pinned_post,
    lala_relevance_score:  generated.lala_relevance_score || 0,
    lala_relevance_reason: generated.lala_relevance_reason,
    book_relevance:        generated.book_relevance || [],
    world_exists:          generated.world_exists || false,
    crossing_trigger:      generated.crossing_trigger,
    crossing_mechanism:    generated.crossing_mechanism,
    // Enhanced fields
    post_frequency:        generated.post_frequency,
    engagement_rate:       generated.engagement_rate,
    platform_metrics:      generated.platform_metrics || {},
    geographic_base:       generated.geographic_base,
    geographic_cluster:    generated.geographic_cluster,
    age_range:             generated.age_range,
    relationship_status:   generated.relationship_status,
    known_associates:      generated.known_associates || [],
    revenue_streams:       generated.revenue_streams || [],
    brand_partnerships:    generated.brand_partnerships || [],
    audience_demographics: generated.audience_demographics || {},
    aesthetic_dna:         generated.aesthetic_dna || {},
    controversy_history:   generated.controversy_history || [],
    collab_style:          generated.collab_style,
    influencer_tier_detail:generated.influencer_tier_detail,
  };
}

module.exports = { generatedProfileFields };
