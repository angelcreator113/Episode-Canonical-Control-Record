// ─── PulseJob.js ─────────────────────────────────────────────────────────────
// One job in The Pulse's posting queue (migration 20261012050000; Task #2968;
// The Pulse spec §7 "jobs run through a queue, never in a live request").
// Claimed and run by the Pulse worker (services/pulseQueue.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseJob extends Model {
    static associate(_models) {}
  }
  PulseJob.init({
    id:           { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:      { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    kind:         { type: DataTypes.STRING(20), allowNull: false },               // event | ambient | comment
    payload_json: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    status:       { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'queued' }, // queued | running | done | failed | skipped
    attempts:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    error:        { type: DataTypes.TEXT, allowNull: true },
    run_after:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    started_at:   { type: DataTypes.DATE, allowNull: true },
    finished_at:  { type: DataTypes.DATE, allowNull: true },
    draft_ids:    { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  }, {
    sequelize, modelName: 'PulseJob',
    tableName: 'pulse_jobs', underscored: true,
    paranoid: true,
  });
  return PulseJob;
};
