// ─── PulseCloseness.js ───────────────────────────────────────────────────────
// One change to the closeness of a pair of Feed profiles in a show: the
// closeness ledger (migration 20261012070000; Task #2983; The Pulse spec §9).
// A pair's closeness at a story moment is its relationship type's closeness
// plus its accepted changes at or before it (services/pulseCloseness.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseCloseness extends Model {
    static associate(_models) {}
  }
  PulseCloseness.init({
    id:              { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:         { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    profile_a_id:    { type: DataTypes.INTEGER, allowNull: false },   // the lower id of the pair
    profile_b_id:    { type: DataTypes.INTEGER, allowNull: false },
    story_order:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    delta:           { type: DataTypes.DECIMAL(5, 3), allowNull: false, defaultValue: 0 },
    closeness_after: { type: DataTypes.DECIMAL(5, 3), allowNull: true },
    cause:           { type: DataTypes.STRING(20), allowNull: false },   // comment | mention | ignored | override
    source_id:       { type: DataTypes.STRING(80), allowNull: true },
    reason:          { type: DataTypes.TEXT, allowNull: true },
    status:          { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'proposed' }, // proposed | accepted | rejected
    decided_by:      { type: DataTypes.STRING(255), allowNull: true },
    decided_at:      { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'PulseCloseness',
    tableName: 'pulse_closeness', underscored: true,
    paranoid: true,
  });
  return PulseCloseness;
};
