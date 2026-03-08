'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SocialProfile extends Model {
    static associate(models) {}
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
    registry_character_id: { type: DataTypes.INTEGER, allowNull: true },
    status:                { type: DataTypes.ENUM('draft','generated','finalized','crossed','archived'), defaultValue: 'draft' },
    generation_model:      { type: DataTypes.STRING(60), allowNull: true },
    full_profile:          { type: DataTypes.JSONB, defaultValue: {} },
  }, {
    sequelize,
    modelName:  'SocialProfile',
    tableName:  'social_profiles',
    underscored: true,
  });

  return SocialProfile;
};
