'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class FeedProfileRelationship extends Model {
    static associate(models) {
      FeedProfileRelationship.belongsTo(models.SocialProfile, {
        foreignKey: 'influencer_a_id',
        as: 'influencerA',
      });
      FeedProfileRelationship.belongsTo(models.SocialProfile, {
        foreignKey: 'influencer_b_id',
        as: 'influencerB',
      });
      FeedProfileRelationship.belongsTo(models.StoryClockMarker, {
        foreignKey: 'story_position',
        as: 'marker',
      });
    }
  }
  FeedProfileRelationship.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    influencer_a_id: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    influencer_b_id: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    relationship_type: {
      type: DataTypes.ENUM(
        'collab', 'beef', 'copy_cat', 'mentor', 'public_shade',
        'silent_alliance', 'former_friends', 'competitors', 'orbit'
      ),
      allowNull: false,
    },
    is_public: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    story_position: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    notes: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName:   'FeedProfileRelationship',
    tableName:   'feed_profile_relationships',
    underscored: true,
    paranoid:    false,
  });
  return FeedProfileRelationship;
};
