'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CharacterArc = sequelize.define('CharacterArc', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    character_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    registry_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'registry_characters', key: 'id' },
    },
    wound_clock: {
      type: DataTypes.INTEGER,
      defaultValue: 75,
      allowNull: false,
    },
    stakes_level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    visibility_score: {
      type: DataTypes.INTEGER,
      defaultValue: 20,
      allowNull: false,
    },
    david_silence_counter: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    phone_appearances: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    bleed_generated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  }, {
    tableName: 'character_arcs',
    timestamps: true,
    underscored: true,
  });

  CharacterArc.associate = (models) => {
    CharacterArc.belongsTo(models.RegistryCharacter, {
      foreignKey: 'registry_id',
      as: 'character',
    });
  };

  return CharacterArc;
};
