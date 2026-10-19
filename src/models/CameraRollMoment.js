// ─── CameraRollMoment.js ─────────────────────────────────────────────────────
// One planned or made photo of a character's life (migration
// 20261019220000-camera-roll; Evoni, 2026-10-19: "photographs should have a
// purpose. Give each character a believable camera roll"). services/cameraRoll.js.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CameraRollMoment extends Model {
    static associate(_models) {}
  }
  CameraRollMoment.init({
    id:           { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    character_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'registry_characters', key: 'id' } },
    status:       { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'proposed' }, // proposed | kept | dropped | made | failed
    moment:       { type: DataTypes.TEXT, allowNull: false },
    purpose:      { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'private' }, // posted | private | sent | work | memory | screenshot
    taken_by:     { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'friend' }, // selfie | mirror | friend | timer | photographer
    shows_face:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    outfit:       { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'none' }, // at_home | going_out | work | event | none
    album:        { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'everyday' },
    place_text:   { type: DataTypes.TEXT, allowNull: true },
    place_ref:    { type: DataTypes.JSONB, allowNull: true },
    story_date:   { type: DataTypes.DATEONLY, allowNull: true },
    event_id:     { type: DataTypes.UUID, allowNull: true },
    episode_id:   { type: DataTypes.UUID, allowNull: true },
    people:       { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    prompt:       { type: DataTypes.TEXT, allowNull: true },
    asset_id:     { type: DataTypes.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' } },
    error:        { type: DataTypes.TEXT, allowNull: true },
    cost:         { type: DataTypes.DECIMAL(10, 4), allowNull: true },
    created_by:   { type: DataTypes.STRING(255), allowNull: true },
  }, {
    sequelize, modelName: 'CameraRollMoment',
    tableName: 'camera_roll_moments', underscored: true,
    paranoid: true,
  });
  return CameraRollMoment;
};
