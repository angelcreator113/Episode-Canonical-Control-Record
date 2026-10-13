// ─── PulseRecap.js ───────────────────────────────────────────────────────────
// The weekly Pulse recap (migration 20261012110000; Task #3008; The Pulse
// spec §11): one per show per week (week_start, a Monday); draft |
// published | dropped; the chosen posts as feed_posts ids in order
// (services/pulseRecap.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseRecap extends Model {
    static associate(_models) {}
  }
  PulseRecap.init({
    id:           { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:      { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    week_start:   { type: DataTypes.DATEONLY, allowNull: false },
    status:       { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'draft' },
    title:        { type: DataTypes.STRING(200), allowNull: false },
    intro:        { type: DataTypes.TEXT, allowNull: true },
    post_ids:     { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    // Each post's image copied to the public site bucket at publishing (migration 20261013090000; Task #3099).
    images:       { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    published_at: { type: DataTypes.DATE, allowNull: true },
    published_by: { type: DataTypes.STRING(255), allowNull: true },
  }, {
    sequelize, modelName: 'PulseRecap',
    tableName: 'pulse_recaps', underscored: true,
    paranoid: true,
  });
  return PulseRecap;
};
