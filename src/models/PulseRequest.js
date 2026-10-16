// ─── PulseRequest.js ─────────────────────────────────────────────────────────
// One AI drafting call in The Pulse's daily request ledger (migration
// 20261013010000; Task #3031). Taken by services/pulseRequests.js before the
// call; each lane (automated | manual) has its own daily limit per show.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseRequest extends Model {
    static associate(_models) {}
  }
  PulseRequest.init({
    id:      { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    lane:    { type: DataTypes.STRING(10), allowNull: false },   // automated | manual
    kind:    { type: DataTypes.STRING(20), allowNull: false },   // event | ambient | comment | storyline | dm | voice | suggestions | reactions | redraft | character_posts
    job_id:  { type: DataTypes.UUID, allowNull: true },
  }, {
    sequelize, modelName: 'PulseRequest',
    tableName: 'pulse_requests', underscored: true,
    paranoid: true,
  });
  return PulseRequest;
};
