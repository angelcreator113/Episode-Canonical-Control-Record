'use strict';
const { DataTypes } = require('sequelize');

/**
 * AssetLabel Model
 * Labels/tags that can be applied to assets
 */
module.exports = (sequelize) => {
  const AssetLabel = sequelize.define(
    'AssetLabel',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      color: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#6366f1',
        validate: {
          is: /^#[0-9A-F]{6}$/i,
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      tableName: 'asset_labels',
      timestamps: false,
      underscored: true,
    }
  );

  // Class methods
  AssetLabel.findByName = async function (name) {
    return this.findOne({ where: { name } });
  };

  AssetLabel.getAllActive = async function () {
    return this.findAll({
      order: [['name', 'ASC']],
    });
  };

  return AssetLabel;
};
