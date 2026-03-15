'use strict';
const { DataTypes } = require('sequelize');

/**
 * CharacterFollowProfile Model
 * Consumer follow system: character consumption affinities
 */
module.exports = (sequelize) => {
  const CharacterFollowProfile = sequelize.define(
    'CharacterFollowProfile',
    {
      id:                    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      character_key:         { type: DataTypes.STRING(100), allowNull: false, unique: true },
      character_name:        { type: DataTypes.STRING(200), allowNull: false },
      registry_character_id: { type: DataTypes.UUID, allowNull: true },

      // Core affinities
      category_affinity:     { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      archetype_affinity:    { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      motivation_weights:    { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Behavioral modifiers
      drama_bonus:           { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.05 },
      adult_penalty:         { type: DataTypes.FLOAT, allowNull: false, defaultValue: -0.10 },
      same_platform_bonus:   { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      follower_tier_affinity:{ type: DataTypes.JSONB, allowNull: false, defaultValue: { micro: 0.60, mid: 0.70, macro: 0.75, mega: 0.65 } },
      base_follow_threshold: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.35 },

      // Consumption pattern
      consumption_style:     { type: DataTypes.STRING(50), allowNull: true },
      consumption_context:   { type: DataTypes.TEXT, allowNull: true },
      has_social_presence:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // Generation metadata
      generated_from_dna:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      generation_reasoning:  { type: DataTypes.TEXT, allowNull: true },
      hand_tuned:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName:  'character_follow_profiles',
      underscored: true,
      paranoid:    false,
    }
  );

  return CharacterFollowProfile;
};
