// ─── EpisodeLookbook.js ──────────────────────────────────────────────────────
// The episode's Lookbook: one live row per episode (migration
// 20261010120000; Task #2812). Hair, nails and beauty live here, not in the
// closet; sheet_status is the style sheet's Draft/Approved.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EpisodeLookbook extends Model {
    static associate(_models) {}
  }
  EpisodeLookbook.init({
    id:                { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    episode_id:        { type: DataTypes.UUID, allowNull: false, references: { model: 'episodes', key: 'id' } },
    show_id:           { type: DataTypes.UUID, allowNull: true, references: { model: 'shows', key: 'id' } },
    hair_name:         { type: DataTypes.STRING(120), allowNull: true },
    nails_name:        { type: DataTypes.STRING(120), allowNull: true },
    beauty_notes:      { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    palette:           { type: DataTypes.JSONB, allowNull: true },
    mood_words:        { type: DataTypes.JSONB, allowNull: true },
    tagline:           { type: DataTypes.STRING(200), allowNull: true },
    sheet_status:      { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    approved_at:       { type: DataTypes.DATE, allowNull: true },
    approved_by:       { type: DataTypes.STRING(255), allowNull: true },
    sheet_asset_id:    { type: DataTypes.UUID, allowNull: true, references: { model: 'assets', key: 'id' } },
    sheet_inputs_hash: { type: DataTypes.STRING(64), allowNull: true },
  }, {
    sequelize, modelName: 'EpisodeLookbook',
    tableName: 'episode_lookbooks', underscored: true,
    paranoid: true,
  });
  return EpisodeLookbook;
};
