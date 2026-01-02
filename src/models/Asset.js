'use strict';
const { DataTypes } = require('sequelize');

/**
 * Asset Model
 * Stores promotional and raw assets (Lala/Guest images, logos, etc.)
 */
module.exports = (sequelize) => {
  const Asset = sequelize.define('Asset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    asset_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['PROMO_LALA', 'PROMO_GUEST', 'BRAND_LOGO', 'EPISODE_FRAME']],
      },
      comment: 'Type of asset: PROMO_LALA, PROMO_GUEST, BRAND_LOGO, EPISODE_FRAME',
    },
    s3_key_raw: {
      type: DataTypes.STRING(500),
      comment: 'S3 key for raw unprocessed image',
    },
    s3_key_processed: {
      type: DataTypes.STRING(500),
      comment: 'S3 key for processed image (background removed)',
    },
    has_transparency: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether processed image has transparency (PNG)',
    },
    width: {
      type: DataTypes.INTEGER,
      comment: 'Image width in pixels',
    },
    height: {
      type: DataTypes.INTEGER,
      comment: 'Image height in pixels',
    },
    file_size_bytes: {
      type: DataTypes.INTEGER,
      comment: 'File size in bytes',
    },
    content_type: {
      type: DataTypes.STRING(100),
      comment: 'MIME type: image/jpeg, image/png, etc.',
    },
    uploaded_by: {
      type: DataTypes.STRING(100),
      comment: 'User ID who uploaded the asset',
    },
    approval_status: {
      type: DataTypes.STRING(50),
      defaultValue: 'PENDING',
      validate: {
        isIn: [['PENDING', 'APPROVED', 'REJECTED']],
      },
      comment: 'Approval status: PENDING, APPROVED, REJECTED',
    },
    metadata: {
      type: DataTypes.JSONB,
      comment: 'Custom metadata: {episode_id, person, outfit, pose, version}',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'assets',
    timestamps: false,
  });

  return Asset;
};
