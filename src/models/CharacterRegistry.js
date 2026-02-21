/**
 * CharacterRegistry Model
 * A named registry of characters for a book/story
 * Location: src/models/CharacterRegistry.js
 */

'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CharacterRegistry = sequelize.define('CharacterRegistry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    book_tag: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    core_rule: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'locked'),
      defaultValue: 'draft',
    },
  }, {
    tableName: 'character_registries',
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  CharacterRegistry.associate = (models) => {
    if (models.Show) {
      CharacterRegistry.belongsTo(models.Show, {
        foreignKey: 'show_id',
        as: 'show',
      });
    }
    if (models.RegistryCharacter) {
      CharacterRegistry.hasMany(models.RegistryCharacter, {
        foreignKey: 'registry_id',
        as: 'characters',
        onDelete: 'CASCADE',
      });
    }
  };

  return CharacterRegistry;
};
