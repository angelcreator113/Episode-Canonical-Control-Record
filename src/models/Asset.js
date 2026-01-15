'use strict';
const { DataTypes } = require('sequelize');

/**
 * Asset Model
 * Stores assets (images, logos, frames, etc.)
 */
module.exports = (sequelize) => {
  const Asset = sequelize.define('Asset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    asset_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    
    // Approval status
    approval_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'APPROVED',
    },
    
    // Raw (original) image
    s3_key_raw: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    s3_url_raw: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    file_size_bytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    
    // Processed (background removed) image
    s3_key_processed: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    s3_url_processed: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    processed_file_size_bytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    
    // Dimensions
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    
    // Processing info
    processing_job_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    processing_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    
    // Legacy fields (backward compatibility)
    s3_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    
    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'assets',
    timestamps: false,
    underscored: true,
  });

  // Class methods
  Asset.findApproved = async function(assetType = null) {
    const where = { approval_status: 'APPROVED' };
    if (assetType) {
      where.asset_type = assetType;
    }
    return this.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
  };

  Asset.findPending = async function() {
    return this.findAll({
      where: { approval_status: 'PENDING' },
      order: [['created_at', 'ASC']],
    });
  };

  return Asset;
};