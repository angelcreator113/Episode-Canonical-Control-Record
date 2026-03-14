'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SocialProfile extends Model {
    static associate(models) {
      if (models.RegistryCharacter) {
        SocialProfile.belongsTo(models.RegistryCharacter, {
          foreignKey: 'registry_character_id',
          as: 'registryCharacter',
        });
      }
      if (models.SocialProfileRelationship) {
        SocialProfile.hasMany(models.SocialProfileRelationship, {
          foreignKey: 'source_profile_id',
          as: 'outgoingRelationships',
        });
        SocialProfile.hasMany(models.SocialProfileRelationship, {
          foreignKey: 'target_profile_id',
          as: 'incomingRelationships',
        });
      }
    }
  }

  SocialProfile.init({
    id:                    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    series_id:             { type: DataTypes.INTEGER, allowNull: true },
    handle:                { type: DataTypes.STRING(100), allowNull: false },
    platform:              { type: DataTypes.ENUM('tiktok','instagram','youtube','twitter','onlyfans','twitch','substack','multi'), allowNull: false },
    vibe_sentence:         { type: DataTypes.TEXT, allowNull: false },
    display_name:          { type: DataTypes.STRING(200), allowNull: true },
    follower_tier:         { type: DataTypes.ENUM('micro','mid','macro','mega'), allowNull: true },
    follower_count_approx: { type: DataTypes.STRING(50), allowNull: true },
    content_category:      { type: DataTypes.STRING(100), allowNull: true },
    archetype:             { type: DataTypes.ENUM('polished_curator','messy_transparent','soft_life','explicitly_paid','overnight_rise','cautionary','the_peer','the_watcher','chaos_creator','community_builder'), allowNull: true },
    content_persona:       { type: DataTypes.TEXT, allowNull: true },
    real_signal:           { type: DataTypes.TEXT, allowNull: true },
    posting_voice:         { type: DataTypes.TEXT, allowNull: true },
    comment_energy:        { type: DataTypes.TEXT, allowNull: true },
    adult_content_present: { type: DataTypes.BOOLEAN, defaultValue: false },
    adult_content_type:    { type: DataTypes.TEXT, allowNull: true },
    adult_content_framing: { type: DataTypes.TEXT, allowNull: true },
    parasocial_function:   { type: DataTypes.TEXT, allowNull: true },
    emotional_activation:  { type: DataTypes.STRING(200), allowNull: true },
    watch_reason:          { type: DataTypes.TEXT, allowNull: true },
    what_it_costs_her:     { type: DataTypes.TEXT, allowNull: true },
    current_trajectory:    { type: DataTypes.ENUM('rising','plateauing','unraveling','pivoting','silent','viral_moment'), defaultValue: 'plateauing' },
    trajectory_detail:     { type: DataTypes.TEXT, allowNull: true },
    moment_log:            { type: DataTypes.JSONB, defaultValue: [] },
    sample_captions:       { type: DataTypes.JSONB, defaultValue: [] },
    sample_comments:       { type: DataTypes.JSONB, defaultValue: [] },
    pinned_post:           { type: DataTypes.TEXT, allowNull: true },
    lala_relevance_score:  { type: DataTypes.INTEGER, defaultValue: 0 },
    lala_relevance_reason: { type: DataTypes.TEXT, allowNull: true },
    book_relevance:        { type: DataTypes.JSONB, defaultValue: [] },
    world_exists:          { type: DataTypes.BOOLEAN, defaultValue: false },
    crossing_trigger:      { type: DataTypes.TEXT, allowNull: true },
    crossing_mechanism:    { type: DataTypes.TEXT, allowNull: true },
    crossed_at:            { type: DataTypes.DATE, allowNull: true },
    registry_character_id: { type: DataTypes.UUID, allowNull: true },

    // ── Enhanced dataset fields ──────────────────────────────────────────────
    post_frequency:        { type: DataTypes.STRING(100), allowNull: true },   // e.g. "3-4x/day", "weekly drops"
    engagement_rate:       { type: DataTypes.STRING(50), allowNull: true },    // e.g. "4.2%", "high for tier"
    platform_metrics:      { type: DataTypes.JSONB, defaultValue: {} },        // avg_views, stories_per_day, live_frequency, etc.
    geographic_base:       { type: DataTypes.STRING(200), allowNull: true },   // city/region
    geographic_cluster:    { type: DataTypes.STRING(100), allowNull: true },   // e.g. "Atlanta creator scene", "LA beauty"
    age_range:             { type: DataTypes.STRING(30), allowNull: true },    // e.g. "mid-20s", "early 30s"
    relationship_status:   { type: DataTypes.STRING(100), allowNull: true },   // single, taken, situationship, it's complicated
    known_associates:      { type: DataTypes.JSONB, defaultValue: [] },        // [{handle, platform, relationship_type, drama_level}]
    revenue_streams:       { type: DataTypes.JSONB, defaultValue: [] },        // ["brand deals", "OF subs", "merch"]
    brand_partnerships:    { type: DataTypes.JSONB, defaultValue: [] },        // [{brand, type, visible}]
    audience_demographics: { type: DataTypes.JSONB, defaultValue: {} },        // {age_range, gender_split, psychographic}
    aesthetic_dna:         { type: DataTypes.JSONB, defaultValue: {} },        // {visual_style, color_palette, editing_style, vibe_tags}
    controversy_history:   { type: DataTypes.JSONB, defaultValue: [] },        // [{event, date_approx, severity, resolved}]
    collab_style:          { type: DataTypes.TEXT, allowNull: true },           // how they collaborate, who they collab with
    influencer_tier_detail:{ type: DataTypes.TEXT, allowNull: true },           // nuanced tier analysis

    // ── Entanglement layer: state tracking ───────────────────────────────────
    current_state: {
      type: DataTypes.ENUM(
        'rising', 'peaking', 'plateauing', 'controversial',
        'cancelled', 'reinventing', 'gone_dark', 'posthumous'
      ),
      allowNull: true,
      defaultValue: null,
    },
    previous_state: {
      type: DataTypes.ENUM(
        'rising', 'peaking', 'plateauing', 'controversial',
        'cancelled', 'reinventing', 'gone_dark', 'posthumous'
      ),
      allowNull: true,
      defaultValue: null,
    },
    state_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },

    status:                { type: DataTypes.ENUM('draft','generated','finalized','crossed','archived'), defaultValue: 'draft' },
    generation_model:      { type: DataTypes.STRING(60), allowNull: true },
    full_profile:          { type: DataTypes.JSONB, defaultValue: {} },

    /* ── Mirror Field (Component 2) ── */
    justawoman_mirror: {
      type: DataTypes.ENUM('ambition','desire_unnamed','visibility_wound','grief','class','body','habits','belonging','shadow','integration'),
      allowNull: true,
    },
    mirror_proposed_by_amber: { type: DataTypes.TEXT, allowNull: true },
    mirror_confirmed:         { type: DataTypes.BOOLEAN, defaultValue: false },
    mirror_confirmed_at:      { type: DataTypes.DATE, allowNull: true },

    /* ── Underground (Component 4) ── */
    visibility_tier: {
      type: DataTypes.ENUM('public','semi_private','underground'),
      defaultValue: 'public',
    },

    /* ── LalaVerse Feed layer ── */
    feed_layer: {
      type: DataTypes.ENUM('real_world', 'lalaverse'),
      defaultValue: 'real_world',
      allowNull: false,
    },
    city: {
      type: DataTypes.ENUM('nova_prime', 'velour_city', 'the_drift', 'solenne', 'cascade_row'),
      allowNull: true,
    },
    lala_relationship: {
      type: DataTypes.ENUM('direct', 'aware', 'one_sided', 'mutual_unaware', 'competitive', 'justawoman'),
      allowNull: true,
    },
    career_pressure: {
      type: DataTypes.ENUM('ahead', 'level', 'behind', 'different_lane'),
      allowNull: true,
    },
    mirror_profile_id: { type: DataTypes.INTEGER, allowNull: true },   // AUTHOR_ONLY — real_world counterpart
    is_justawoman_record: { type: DataTypes.BOOLEAN, defaultValue: false },
    lalaverse_cap_exempt:  { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    sequelize,
    modelName:  'SocialProfile',
    tableName:  'social_profiles',
    underscored: true,
  });

  return SocialProfile;
};
