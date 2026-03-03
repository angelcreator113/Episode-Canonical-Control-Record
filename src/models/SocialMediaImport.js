'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SocialMediaImport = sequelize.define('SocialMediaImport', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    character_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    source_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    raw_content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    detected_voice: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lala_detected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lala_markers: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    parsed_content: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    emotional_tags: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    canon_status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'pending',
    },
    assigned_story_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    import_batch: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    tableName: 'social_media_imports',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  SocialMediaImport.associate = (models) => {
    if (models.StorytellerStory) {
      SocialMediaImport.belongsTo(models.StorytellerStory, {
        foreignKey: 'assigned_story_id',
        as: 'assignedStory',
      });
    }
  };

  return SocialMediaImport;
};
