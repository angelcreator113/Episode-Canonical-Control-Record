'use strict';
const { DataTypes } = require('sequelize');

/**
 * AssetUsage Model
 * Tracks where assets are used in the system
 */
module.exports = (sequelize) => {
  const AssetUsage = sequelize.define(
    'AssetUsage',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      asset_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'assets',
          key: 'id',
        },
      },
      used_in_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Type: composition, episode, template',
      },
      used_in_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'asset_usage',
      timestamps: false,
      underscored: true,
    }
  );

  // Class methods
  AssetUsage.trackUsage = async function (assetId, usedInType, usedInId) {
    return this.create({
      asset_id: assetId,
      used_in_type: usedInType,
      used_in_id: usedInId,
    });
  };

  AssetUsage.getAssetUsage = async function (assetId) {
    return this.findAll({
      where: { asset_id: assetId },
      order: [['created_at', 'DESC']],
    });
  };

  return AssetUsage;
};
