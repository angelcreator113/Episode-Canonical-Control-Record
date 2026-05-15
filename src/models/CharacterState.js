'use strict';
const { DataTypes } = require('sequelize');
/**
 * CharacterState — per-show character stat ledger.
 * One row per (show_id, season_id, character_key) tracking
 * cumulative coins / reputation / brand_trust / influence / stress
 * and the last episode applied (for idempotency).
 *
 * F-Stats-1 keystone — created Phase A G2 to consolidate raw-SQL
 * access scattered across 19 files. NO hooks, NO associations
 * during F-Stats-1 (Decisions #4 and #5).
 */
module.exports = (sequelize) => {
  const CharacterState = sequelize.define('CharacterState', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },
    season_id: { type: DataTypes.UUID, allowNull: true },
    character_key: {
      type: DataTypes.STRING(50), allowNull: false,
      // 'lala' (user-facing) | 'justawoman' (backend) | 'guest:<id>'
      // Drift preserved per Decision #6; F-Sec-3 will consolidate.
    },
    coins: { type: DataTypes.INTEGER, defaultValue: 500 },
    reputation: {
      type: DataTypes.INTEGER, defaultValue: 1,
      // 0-10 scale
    },
    brand_trust: { type: DataTypes.INTEGER, defaultValue: 1 },
    influence: { type: DataTypes.INTEGER, defaultValue: 1 },
    stress: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_applied_episode_id: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'character_state',
    underscored: true,
    timestamps: true,
  });
  return CharacterState;
};
