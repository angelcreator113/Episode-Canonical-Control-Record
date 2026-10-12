// ─── PulseDmThread.js ────────────────────────────────────────────────────────
// A DM conversation between two Feed profiles in a show (migration
// 20261012080000; Task #2984; The Pulse spec §3). profile_a_id is the lower
// id of the pair; one thread per pair (services/pulseDms.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseDmThread extends Model {
    static associate(_models) {}
  }
  PulseDmThread.init({
    id:                 { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:            { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    profile_a_id:       { type: DataTypes.INTEGER, allowNull: false },
    profile_b_id:       { type: DataTypes.INTEGER, allowNull: false },
    opened_story_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    topic:              { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'PulseDmThread',
    tableName: 'pulse_dm_threads', underscored: true,
    paranoid: true,
  });
  return PulseDmThread;
};
