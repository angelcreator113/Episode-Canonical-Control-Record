// ─── PulseFollow.js ──────────────────────────────────────────────────────────
// One person following another on The Pulse, one way (migration
// 20261019190000; Evoni, 2026-10-19). Two people who follow each other are
// friends (services/pulseFollows.js). Unfollowing soft-deletes the row.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseFollow extends Model {
    static associate(_models) {}
  }
  PulseFollow.init({
    id:                  { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    follower_profile_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'social_profiles', key: 'id' } },
    followed_profile_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'social_profiles', key: 'id' } },
    source:              { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'evoni' }, // auto_feed | evoni | seed_friends
    created_by:          { type: DataTypes.STRING(255), allowNull: true },
  }, {
    sequelize, modelName: 'PulseFollow',
    tableName: 'pulse_follows', underscored: true,
    paranoid: true,
  });
  return PulseFollow;
};
