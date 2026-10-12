// ─── PulsePoll.js ────────────────────────────────────────────────────────────
// An audience poll about an event's (or an episode's) look (migration
// 20261012100000; Task #3005; The Pulse spec §11). status draft | open |
// closed (services/pulsePolls.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulsePoll extends Model {
    static associate(_models) {}
  }
  PulsePoll.init({
    id:             { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:        { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    world_event_id: { type: DataTypes.UUID, allowNull: true },
    episode_id:     { type: DataTypes.UUID, allowNull: true },
    question:       { type: DataTypes.TEXT, allowNull: false },
    status:         { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'draft' },
    closes_at:      { type: DataTypes.DATE, allowNull: true },
    opened_at:      { type: DataTypes.DATE, allowNull: true },
    closed_at:      { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'PulsePoll',
    tableName: 'pulse_polls', underscored: true,
    paranoid: true,
  });
  return PulsePoll;
};
