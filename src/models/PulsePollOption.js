// ─── PulsePollOption.js ──────────────────────────────────────────────────────
// One choice in an audience poll (migration 20261012100000; Task #3005):
// Evoni's label and the look it means as wardrobe item ids, never copies.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulsePollOption extends Model {
    static associate(_models) {}
  }
  PulsePollOption.init({
    id:           { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    poll_id:      { type: DataTypes.UUID, allowNull: false, references: { model: 'pulse_polls', key: 'id' } },
    label:        { type: DataTypes.STRING(200), allowNull: false },
    wardrobe_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    sort_order:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    sequelize, modelName: 'PulsePollOption',
    tableName: 'pulse_poll_options', underscored: true,
    paranoid: true,
  });
  return PulsePollOption;
};
