// ─── PulseVoice.js ───────────────────────────────────────────────────────────
// A posting character's Voice Profile (migration 20261012040000; Task #2967;
// The Pulse spec §7): the habits the drafter writes in, and Evoni's edits
// and pinned posts as examples (services/pulseVoices.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseVoice extends Model {
    static associate(_models) {}
  }
  PulseVoice.init({
    id:                    { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    registry_character_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'registry_characters', key: 'id' } },
    social_profile_id:     { type: DataTypes.INTEGER, allowNull: true },
    habits_json:           { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    examples_json:         { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    source_hash:           { type: DataTypes.STRING(64), allowNull: true },
    status:                { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'built' }, // built | edited
    built_at:              { type: DataTypes.DATE, allowNull: true },
    edited_by:             { type: DataTypes.STRING(255), allowNull: true },
    edited_at:             { type: DataTypes.DATE, allowNull: true },
    // Evoni's approval (Task #3029): the worker drafts only for an approved voice.
    approved_at:           { type: DataTypes.DATE, allowNull: true },
    approved_by:           { type: DataTypes.STRING(255), allowNull: true },
  }, {
    sequelize, modelName: 'PulseVoice',
    tableName: 'pulse_voices', underscored: true,
    paranoid: true,
  });
  return PulseVoice;
};
