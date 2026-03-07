'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CharacterSpark = sequelize.define('CharacterSpark', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    desire_line: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    wound: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    prefill_result: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
    },
    registry_character_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    registry_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'character_sparks',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return CharacterSpark;
};
