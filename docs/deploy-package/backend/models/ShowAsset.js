'use strict';
const { DataTypes } = require('sequelize');

/**
 * ShowAsset Model
 * Junction table linking assets to shows with usage context
 */
module.exports = (sequelize) => {
  const ShowAsset = sequelize.define(
    'ShowAsset',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      show_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'shows',
          key: 'id',
        },
      },
      asset_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'assets',
          key: 'id',
        },
      },
      usage_context: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'How this asset is used in the show context',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Order for displaying assets',
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Is this the primary asset for this show',
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
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'show_assets',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      underscored: true,
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['show_id', 'asset_id'],
          where: { deleted_at: null },
        },
        {
          fields: ['show_id'],
        },
        {
          fields: ['asset_id'],
        },
      ],
    }
  );

  return ShowAsset;
};
