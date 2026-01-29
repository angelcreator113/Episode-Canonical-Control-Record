/**
 * CompositionOutput Model
 * Stores generated thumbnail outputs per format with status tracking
 */
'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompositionOutput = sequelize.define(
    'CompositionOutput',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      composition_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'thumbnail_compositions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      format: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Output format identifier (e.g., YOUTUBE, INSTAGRAM_FEED, YOUTUBE_1920x1080)',
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'PROCESSING',
        validate: {
          isIn: [['PROCESSING', 'READY', 'FAILED']],
        },
        comment: 'Generation status: PROCESSING, READY, FAILED',
      },
      image_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'S3 URL or CDN path to generated thumbnail image',
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Image width in pixels',
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Image height in pixels',
      },
      file_size: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'File size in bytes',
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error details if status is FAILED',
      },
      generated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
        comment: 'Timestamp when output was successfully generated',
      },
      generated_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'User who triggered generation',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'composition_outputs',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['composition_id'],
          name: 'idx_composition_outputs_composition_id',
        },
        {
          fields: ['status'],
          name: 'idx_composition_outputs_status',
        },
        {
          fields: ['format'],
          name: 'idx_composition_outputs_format',
        },
        {
          unique: true,
          fields: ['composition_id', 'format'],
          name: 'composition_outputs_composition_format_unique',
        },
      ],
    }
  );

  // Define associations
  CompositionOutput.associate = (models) => {
    CompositionOutput.belongsTo(models.ThumbnailComposition, {
      foreignKey: 'composition_id',
      as: 'composition',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return CompositionOutput;
};
