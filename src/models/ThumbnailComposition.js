'use strict';
const { DataTypes } = require('sequelize');

/**
 * ThumbnailComposition Model
 * Stores composition metadata for generated thumbnails
 */
module.exports = (sequelize) => {
  const ThumbnailComposition = sequelize.define('ThumbnailComposition', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    episode_id: {
      type: DataTypes.UUID,
      references: {
        model: 'episodes',
        key: 'id',
      },
      comment: 'Episode this composition is for',
    },
    thumbnail_id: {
      type: DataTypes.UUID,
      references: {
        model: 'thumbnails',
        key: 'id',
      },
      comment: 'Generated thumbnail from composition',
    },
    template_id: {
      type: DataTypes.STRING(100),
      references: {
        model: 'thumbnail_templates',
        key: 'id',
      },
      comment: 'Template used for composition',
    },
    background_frame_asset_id: {
      type: DataTypes.UUID,
      references: {
        model: 'assets',
        key: 'id',
      },
      comment: 'Background frame asset from episode',
    },
    lala_asset_id: {
      type: DataTypes.UUID,
      references: {
        model: 'assets',
        key: 'id',
      },
      comment: 'Lala promotional image asset',
    },
    guest_asset_id: {
      type: DataTypes.UUID,
      references: {
        model: 'assets',
        key: 'id',
      },
      comment: 'Guest promotional image asset',
    },
    composition_config: {
      type: DataTypes.JSONB,
      comment: 'Composition configuration: {template_id, layers, positioning}',
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Version number for tracking updates',
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is the primary thumbnail for episode',
    },
    approval_status: {
      type: DataTypes.STRING(50),
      defaultValue: 'DRAFT',
      validate: {
        isIn: [['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']],
      },
      comment: 'Approval status: DRAFT, PENDING, APPROVED, REJECTED',
    },
    published_at: {
      type: DataTypes.DATE,
      comment: 'When composition was published',
    },
    created_by: {
      type: DataTypes.STRING(100),
      comment: 'User ID who created composition',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    approved_by: {
      type: DataTypes.STRING(100),
      comment: 'User ID who approved composition',
    },
    approved_at: {
      type: DataTypes.DATE,
      comment: 'When composition was approved',
    },
  }, {
    tableName: 'thumbnail_compositions',
    timestamps: false,
  });

  return ThumbnailComposition;
};
