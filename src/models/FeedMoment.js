'use strict';
const { DataTypes } = require('sequelize');

/**
 * FeedMoment — persisted phone-screen moments generated during episodes.
 * Each moment captures what Lala sees on her phone, her reaction,
 * and the narrative impact on the scene.
 */
module.exports = (sequelize) => {
  const FeedMoment = sequelize.define('FeedMoment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },
    episode_id: { type: DataTypes.UUID, allowNull: false },
    event_id: { type: DataTypes.UUID, allowNull: true },

    beat_number: { type: DataTypes.INTEGER, allowNull: false },
    beat_context: { type: DataTypes.TEXT, allowNull: true },

    // Who triggered the moment
    trigger_profile_id: { type: DataTypes.INTEGER, allowNull: true },
    trigger_handle: { type: DataTypes.STRING(100), allowNull: true },
    trigger_action: { type: DataTypes.STRING(100), allowNull: true },

    // What appears on screen
    phone_screen_type: {
      type: DataTypes.STRING(30), allowNull: true,
      // notification | post | story | dm | live | ui_interaction
    },
    screen_content: { type: DataTypes.TEXT, allowNull: true },
    screen_image_desc: { type: DataTypes.TEXT, allowNull: true },
    asset_type: { type: DataTypes.STRING(50), allowNull: true },
    asset_role: { type: DataTypes.STRING(80), allowNull: true },

    // Dual voice script lines
    justawoman_line: { type: DataTypes.TEXT, allowNull: true },
    justawoman_action: { type: DataTypes.STRING(200), allowNull: true },
    lala_line: { type: DataTypes.TEXT, allowNull: true },
    lala_internal: { type: DataTypes.TEXT, allowNull: true },
    direction: { type: DataTypes.TEXT, allowNull: true },

    // Financial context (for purchase-decision moments)
    financial_context: { type: DataTypes.JSONB, allowNull: true },

    // Narrative impact
    emotional_shift: {
      type: DataTypes.STRING(50), allowNull: true,
      // confidence | anxiety | jealousy | determination | doubt | rage | numbness
    },
    behavior_change: { type: DataTypes.TEXT, allowNull: true },
    feeds_into_beat: { type: DataTypes.INTEGER, allowNull: true },

    sort_order: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  }, {
    tableName: 'feed_moments',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  FeedMoment.associate = (models) => {
    if (models.Episode) FeedMoment.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
    if (models.Show) FeedMoment.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
    if (models.WorldEvent) FeedMoment.belongsTo(models.WorldEvent, { foreignKey: 'event_id', as: 'event' });
    if (models.SocialProfile) FeedMoment.belongsTo(models.SocialProfile, { foreignKey: 'trigger_profile_id', as: 'triggerProfile' });
  };

  return FeedMoment;
};
