'use strict';
const { DataTypes } = require('sequelize');

/**
 * ScriptMetadata Model  
 * AI-enhanced metadata for episode scripts (scene detection)
 */
module.exports = (sequelize) => {
  const ScriptMetadata = sequelize.define(
    'ScriptMetadata',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      script_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'episode_scripts',
          key: 'id',
        },
        onDelete: 'CASCADE',
        field: 'script_id',
      },
      scene_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'scene_id',
        comment: 'Scene identifier from script (e.g., INTRO, MAIN-1)',
      },
      scene_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'scene_type',
        comment: 'intro | main | transition | outro',
      },
      duration_target_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'duration_target_seconds',
        comment: 'AI-suggested duration',
      },
      energy_level: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'energy_level',
        comment: 'high | medium | low',
      },
      estimated_clips_needed: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'estimated_clips_needed',
        comment: 'How many clips AI estimates are needed',
      },
      visual_requirements: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'visual_requirements',
        comment: 'Suggested visuals (wardrobe, B-roll, etc.)',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'ScriptMetadata',
      tableName: 'script_metadata',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: false, // Disable soft deletes (no deleted_at column)
    }
  );

  return ScriptMetadata;
};
