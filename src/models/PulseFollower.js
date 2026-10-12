// ─── PulseFollower.js ────────────────────────────────────────────────────────
// One change to a Feed profile's followers in a show: the follower ledger
// (migration 20261012010000; Task #2952; The Pulse spec §8). The count at a
// story moment is the latest accepted row at or before it
// (services/pulseFollowers.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseFollower extends Model {
    static associate(_models) {}
  }
  PulseFollower.init({
    id:                { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:           { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    social_profile_id: { type: DataTypes.INTEGER, allowNull: false },
    story_order:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    change:            { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    count_after:       { type: DataTypes.INTEGER, allowNull: true },
    cause:             { type: DataTypes.STRING(20), allowNull: false },   // start | episode | post | event | override
    cause_id:          { type: DataTypes.STRING(64), allowNull: true },
    reason:            { type: DataTypes.TEXT, allowNull: true },
    status:            { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'proposed' }, // proposed | accepted | rejected
    decided_by:        { type: DataTypes.STRING(255), allowNull: true },
    decided_at:        { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'PulseFollower',
    tableName: 'pulse_followers', underscored: true,
    paranoid: true,
  });
  return PulseFollower;
};
