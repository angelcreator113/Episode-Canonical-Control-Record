/**
 * CompositionAsset Model
 * Junction table linking compositions to assets by role
 */

module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const CompositionAsset = sequelize.define(
    'CompositionAsset',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
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
      asset_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'assets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      asset_role: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Role this asset plays in the composition (e.g., BG.MAIN, CHAR.HOST.PRIMARY)',
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
      tableName: 'composition_assets',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['composition_id'],
        },
        {
          fields: ['asset_id'],
        },
        {
          fields: ['asset_role'],
        },
        {
          unique: true,
          fields: ['composition_id', 'asset_role'],
          name: 'composition_assets_composition_role_unique',
        },
      ],
    }
  );

  return CompositionAsset;
};
