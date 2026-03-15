// models/StoryTexture.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StoryTexture = sequelize.define('StoryTexture', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    story_number:    { type: DataTypes.INTEGER, allowNull: false },
    character_key:   { type: DataTypes.STRING, allowNull: false },
    registry_id:     { type: DataTypes.UUID, allowNull: true },

    // Inner thought
    inner_thought_type: {
      type: DataTypes.ENUM('filed_thought', 'loud_secret', 'revision'),
      allowNull: true,
    },
    inner_thought_text:      { type: DataTypes.TEXT, allowNull: true },
    inner_thought_confirmed: { type: DataTypes.BOOLEAN, defaultValue: false },

    // Conflict
    conflict_eligible:       { type: DataTypes.BOOLEAN, defaultValue: false },
    conflict_trigger:        { type: DataTypes.TEXT, allowNull: true },
    conflict_surface_text:   { type: DataTypes.TEXT, allowNull: true },
    conflict_subtext:        { type: DataTypes.TEXT, allowNull: true },
    conflict_silence_beat:   { type: DataTypes.TEXT, allowNull: true },
    conflict_resolution_type: {
      type: DataTypes.ENUM(
        'deflected', 'deferred', 'exploded', 'absorbed', 'weaponized'
      ),
      allowNull: true,
    },
    conflict_confirmed: { type: DataTypes.BOOLEAN, defaultValue: false },

    // Body narrator
    body_narrator_text:      { type: DataTypes.TEXT, allowNull: true },
    body_narrator_confirmed: { type: DataTypes.BOOLEAN, defaultValue: false },

    // Private moment
    private_moment_eligible:       { type: DataTypes.BOOLEAN, defaultValue: false },
    private_moment_setting:        { type: DataTypes.STRING, allowNull: true },
    private_moment_held_thing:     { type: DataTypes.TEXT, allowNull: true },
    private_moment_sensory_anchor: { type: DataTypes.TEXT, allowNull: true },
    private_moment_text:           { type: DataTypes.TEXT, allowNull: true },
    private_moment_confirmed:      { type: DataTypes.BOOLEAN, defaultValue: false },

    // Online self post
    post_text:                    { type: DataTypes.TEXT, allowNull: true },
    post_platform:                {
      type: DataTypes.ENUM('instagram', 'tiktok', 'youtube', 'twitter'),
      allowNull: true,
    },
    post_audience_bestie:         { type: DataTypes.TEXT, allowNull: true },
    post_audience_paying_man:     { type: DataTypes.TEXT, allowNull: true },
    post_audience_competitive_woman: { type: DataTypes.TEXT, allowNull: true },
    post_confirmed:               { type: DataTypes.BOOLEAN, defaultValue: false },

    // Bleed
    bleed_text:      { type: DataTypes.TEXT, allowNull: true },
    bleed_confirmed: { type: DataTypes.BOOLEAN, defaultValue: false },

    // Phone
    phone_appeared: { type: DataTypes.BOOLEAN, defaultValue: false },
    phone_context:  { type: DataTypes.TEXT, allowNull: true },

    // Amber
    amber_notes:   { type: DataTypes.JSONB, allowNull: true },
    amber_read_at: { type: DataTypes.DATE, allowNull: true },

    // Assembly
    fully_confirmed: { type: DataTypes.BOOLEAN, defaultValue: false },
    confirmed_at:    { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'story_texture',
    underscored: true,
  });

  return StoryTexture;
};
