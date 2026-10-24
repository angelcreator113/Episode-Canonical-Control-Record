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
    // family_kind: blood | step | adoptive | married | chosen (migration 20261024000000);
    //   written with is_blood_relation (blood ⇔ true). reverse_family_role reads
    //   "B is A's <role>" as family_role reads "A is B's" (services/familyTies).
    family_kind:            { type: DataTypes.STRING(20), allowNull: true, defaultValue: null,
      validate: { isIn: [['blood', 'step', 'adoptive', 'married', 'chosen']] } },
    reverse_family_role:    { type: DataTypes.STRING(120), allowNull: true, defaultValue: null },
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

    /* ── Who knows about it (services/relationshipKnowers, 2026-10-23) ── */
    // Besides the two of them: [{ registry_character_id | profile_id | name, since_episode_id?, how? }]
    known_by:               { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    // Everyone else: secret | rumoured | known
    public_state:           { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'known' },

    /* ── Seeds (services/relationshipSeeds, migration 20261024200000) ── */
    // Where an unconfirmed row came from, why, and what Evoni did with it.
    seed_source:            { type: DataTypes.STRING(20), allowNull: true, defaultValue: null,
      validate: { isIn: [['generate', 'family', 'scene', 'pulse', 'manual']] } },
    seed_why:               { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    // { episodes:[{id,number,title}], threads:[{id,title}], twists:[{id,title}], facts:[string] }
    seed_basis:             { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
    // null (pending) | kept ("Keep as idea") | later (dismissed as "too soon")
    seed_state:             { type: DataTypes.STRING(20), allowNull: true, defaultValue: null,
      validate: { isIn: [['kept', 'later']] } },
    dismiss_reason:         { type: DataTypes.STRING(30), allowNull: true, defaultValue: null,
      validate: { isIn: [['wrong_for_them', 'too_soon', 'already_covered', 'not_this_type', 'other']] } },
    dismiss_note:           { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    // What Generate was aimed at: { kind, focus_character_id, episode_id, twist_id }
    seed_aim:               { type: DataTypes.JSONB, allowNull: true, defaultValue: null },

    /* ── Scene Brief Classification ── */
    // role_tag: ally | detractor | mentor | dependency | rival | partner | family | neutral
    role_tag:               { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
  }, {
    tableName: 'character_relationships',
    timestamps: true,
    underscored: true,
    // deleted_at is in the table (migration 20260309130000) and raw SQL
    // filters it; the model now says so too (Task #3119). The routes' own
    // DELETEs stay hard deletes.
    paranoid: true,
    deletedAt: 'deleted_at',
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
