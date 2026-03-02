'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CharacterRelationship = sequelize.define('CharacterRelationship', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    character_id_a: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'registry_characters', key: 'id' },
    },
    character_id_b: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'registry_characters', key: 'id' },
    },
    relationship_type: { type: DataTypes.STRING(100), allowNull: false },
    connection_mode:   { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'IRL' },
    lala_connection:   { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'none' },
    status:            { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Active' },
    notes:             { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'character_relationships',
    timestamps: true,
    underscored: true,
    paranoid: false,
  });

  CharacterRelationship.associate = (models) => {
    CharacterRelationship.belongsTo(models.RegistryCharacter, {
      foreignKey: 'character_id_a',
      as: 'characterA',
    });
    CharacterRelationship.belongsTo(models.RegistryCharacter, {
      foreignKey: 'character_id_b',
      as: 'characterB',
    });
  };

  return CharacterRelationship;
};
