// ─── PulseDmMessage.js ───────────────────────────────────────────────────────
// One DM message (migration 20261012080000; Task #2984; The Pulse spec §3):
// drafted in its sender's voice through the queue, gated, and live only once
// Evoni approves it (services/pulseDms.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseDmMessage extends Model {
    static associate(_models) {}
  }
  PulseDmMessage.init({
    id:                { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    thread_id:         { type: DataTypes.UUID, allowNull: false, references: { model: 'pulse_dm_threads', key: 'id' } },
    show_id:           { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    sender_profile_id: { type: DataTypes.INTEGER, allowNull: false },
    text:              { type: DataTypes.TEXT, allowNull: false },
    story_order:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status:            { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'draft' }, // draft | live | rejected
    gate_json:         { type: DataTypes.JSONB, allowNull: true },
    ai_generated:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    generation_model:  { type: DataTypes.STRING(80), allowNull: true },
    posted_at:         { type: DataTypes.DATE, allowNull: true },
    decided_by:        { type: DataTypes.STRING(255), allowNull: true },
    decided_at:        { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'PulseDmMessage',
    tableName: 'pulse_dm_messages', underscored: true,
    paranoid: true,
  });
  return PulseDmMessage;
};
