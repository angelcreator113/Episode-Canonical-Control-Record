const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VideoComposition = sequelize.define(
  'VideoComposition',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    episode_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'episodes',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('draft', 'processing', 'complete', 'error'),
      defaultValue: 'draft',
    },
    scenes: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of {scene_id, role, order}',
    },
    assets: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of {asset_id, role, order}',
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Export settings and other configuration',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'video_compositions',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = VideoComposition;
