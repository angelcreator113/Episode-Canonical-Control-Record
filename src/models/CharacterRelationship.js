'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CharacterRelationship = sequelize.define('CharacterRelationship', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id:      { type: DataTypes.UUID, allowNull: true },
    book_id:      { type: DataTypes.UUID, allowNull: true },
    layer:        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'real_world' },
    source_name:  { type: DataTypes.STRING(120), allowNull: false },
    target_name:  { type: DataTypes.STRING(120), allowNull: false },
    relationship_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'knows' },
    direction:    { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'both' },
    label:        { type: DataTypes.STRING(60) },
    subtext:      { type: DataTypes.STRING(200) },
    source_knows: { type: DataTypes.TEXT },
    target_knows: { type: DataTypes.TEXT },
    reader_knows: { type: DataTypes.TEXT },
    status:       { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
    appears_in:   { type: DataTypes.JSONB, defaultValue: [] },
    intensity:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    notes:        { type: DataTypes.TEXT },
    source_x:     { type: DataTypes.FLOAT, defaultValue: 0 },
    source_y:     { type: DataTypes.FLOAT, defaultValue: 0 },
    target_x:     { type: DataTypes.FLOAT, defaultValue: 0 },
    target_y:     { type: DataTypes.FLOAT, defaultValue: 0 },
  }, {
    tableName: 'character_relationships',
    timestamps: true,
    underscored: true,
    paranoid: false, // No deleted_at column in migration
  });

  return CharacterRelationship;
};
