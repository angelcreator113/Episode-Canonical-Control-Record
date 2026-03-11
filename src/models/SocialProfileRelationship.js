'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SocialProfileRelationship extends Model {
    static associate(models) {
      if (models.SocialProfile) {
        SocialProfileRelationship.belongsTo(models.SocialProfile, {
          foreignKey: 'source_profile_id',
          as: 'sourceProfile',
        });
        SocialProfileRelationship.belongsTo(models.SocialProfile, {
          foreignKey: 'target_profile_id',
          as: 'targetProfile',
        });
      }
    }
  }

  SocialProfileRelationship.init({
    id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    source_profile_id:  { type: DataTypes.INTEGER, allowNull: false },
    target_profile_id:  { type: DataTypes.INTEGER, allowNull: false },
    relationship_type:  {
      type: DataTypes.ENUM(
        'collab',          // they make content together
        'rival',           // competitive tension, same niche
        'couple',          // romantic relationship (public)
        'ex',              // used to date, now tension
        'baby_daddy',      // co-parent dynamic, often messy
        'baby_mama',       // co-parent dynamic
        'bestie',          // ride-or-die public friendship
        'mentor',          // one built the other up
        'copycat',         // one is clearly mimicking the other
        'shade',           // mutual or one-sided shade/beef
        'situationship',   // unclear romantic entanglement
        'family',          // siblings, cousins, etc.
        'management',      // one manages the other
        'feud',            // full public war
        'secret_link'      // connected but nobody knows yet
      ),
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM('mutual', 'source_to_target', 'target_to_source'),
      defaultValue: 'mutual',
    },
    drama_level:        { type: DataTypes.INTEGER, defaultValue: 0 }, // 0-10
    public_visibility:  { type: DataTypes.ENUM('public', 'rumored', 'hidden'), defaultValue: 'public' },
    description:        { type: DataTypes.TEXT, allowNull: true },
    timeline_notes:     { type: DataTypes.TEXT, allowNull: true }, // when it started, key events
    narrative_function: { type: DataTypes.TEXT, allowNull: true }, // how it serves the story
    auto_generated:     { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    sequelize,
    modelName:  'SocialProfileRelationship',
    tableName:  'social_profile_relationships',
    underscored: true,
  });

  return SocialProfileRelationship;
};
