// ─── PulsePostNumber.js ──────────────────────────────────────────────────────
// A live post's proposed and canon likes and shares (migration
// 20261012020000; Task #2953; The Pulse spec §8). Proposed when the post goes
// live (services/pulseNumbers.js); comments are never proposed.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulsePostNumber extends Model {
    static associate(_models) {}
  }
  PulsePostNumber.init({
    id:                { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    post_id:           { type: DataTypes.UUID, allowNull: false, references: { model: 'feed_posts', key: 'id' } },
    show_id:           { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    social_profile_id: { type: DataTypes.INTEGER, allowNull: true },
    poster_handle:     { type: DataTypes.STRING(100), allowNull: true },
    proposed_likes:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    proposed_shares:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    factors_json:      { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    seed:              { type: DataTypes.BIGINT, allowNull: false },
    status:            { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'proposed' }, // proposed | accepted | adjusted | viral | flop
    final_likes:       { type: DataTypes.INTEGER, allowNull: true },
    final_shares:      { type: DataTypes.INTEGER, allowNull: true },
    reason:            { type: DataTypes.TEXT, allowNull: true },
    flag:              { type: DataTypes.STRING(20), allowNull: true },   // lala | about_lala | spike | no_followers
    decided_by:        { type: DataTypes.STRING(255), allowNull: true },
    decided_at:        { type: DataTypes.DATE, allowNull: true },
    story_order:       { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize, modelName: 'PulsePostNumber',
    tableName: 'pulse_post_numbers', underscored: true,
    paranoid: true,
  });
  return PulsePostNumber;
};
