'use strict';
const { DataTypes } = require('sequelize');

/**
 * Asset Model
 * Represents all media assets (images, videos) including wardrobe items
 */
module.exports = (sequelize) => {
  const Asset = sequelize.define(
    'Asset',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      asset_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Type of asset (PROMO_LALA, CLOTHING_DRESS, etc.)',
      },
      s3_key_raw: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      s3_key_processed: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      has_transparency: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      file_size_bytes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      content_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      uploaded_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      approval_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'assets',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      paranoid: false,
    }
  );

  // Define associations
  Asset.associate = function (models) {
    // Many-to-many with Episodes through episode_assets junction table
    Asset.belongsToMany(models.Episode, {
      through: 'episode_assets',
      foreignKey: 'asset_id',
      otherKey: 'episode_id',
      as: 'episodes',
    });
  };

  return Asset;
};
