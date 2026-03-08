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

    /* ── Ensemble-World Fields ── */
    // family_role: mother | father | sister | brother | aunt | uncle | cousin |
    //   grandmother | grandfather | daughter | son | niece | nephew | stepmother | stepsister | etc.
    family_role:            { type: DataTypes.STRING(120), allowNull: true, defaultValue: null },
    // is_blood_relation: true = biological family. false = found family, step, or chosen.
    is_blood_relation:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // is_romantic: Explicit romantic flag — enables filtering independent of relationship_type label.
    is_romantic:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // conflict_summary: The conflict between character A and character B — independent of Lala.
    conflict_summary:       { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    // knows_about_connection: Does character B know about character A's connection to Lala / JustAWoman?
    knows_about_connection: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    /* ── Knowledge Asymmetry ── */
    // What each person knows about the other — relationship-level defaults
    source_knows:           { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    target_knows:           { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    reader_knows:           { type: DataTypes.TEXT, allowNull: true, defaultValue: null },

    /* ── Scene Brief Classification ── */
    // role_tag: ally | detractor | mentor | dependency | rival | partner | family | neutral
    role_tag:               { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
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
