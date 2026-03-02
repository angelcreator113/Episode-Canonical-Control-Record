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
    relationship_type:      { type: DataTypes.STRING(100), allowNull: false },
    connection_mode:        { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'IRL' },
    lala_connection:        { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'none' },
    status:                 { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Active' },
    notes:                  { type: DataTypes.TEXT, allowNull: true },
    situation:              { type: DataTypes.TEXT, allowNull: true },
    tension_state:          { type: DataTypes.STRING(80), allowNull: true },
    pain_point_category:    { type: DataTypes.STRING(100), allowNull: true },
    lala_mirror:            { type: DataTypes.TEXT, allowNull: true },
    career_echo_potential:  { type: DataTypes.TEXT, allowNull: true },
    confirmed:              { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
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
