// ─── WebsiteSlot.js ──────────────────────────────────────────────────────────
// One media slot on the public landing page (migration 20261010150000;
// Task #2821). Managed by admins at /api/v1/website-slots; only published
// rows are served, with whitelisted fields, at /api/v1/public/site-content.
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WebsiteSlot extends Model {
    static associate(_models) {}
  }
  WebsiteSlot.init({
    id:               { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    slot_key:         { type: DataTypes.STRING(40), allowNull: false },
    media_type:       { type: DataTypes.STRING(20), allowNull: true },
    file_key:         { type: DataTypes.TEXT, allowNull: true },
    youtube_id:       { type: DataTypes.STRING(20), allowNull: true },
    poster_key:       { type: DataTypes.TEXT, allowNull: true },
    captions_key:     { type: DataTypes.TEXT, allowNull: true },
    alt_text:         { type: DataTypes.STRING(300), allowNull: true },
    has_speech:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    duration_seconds: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    file_size_bytes:  { type: DataTypes.INTEGER, allowNull: true },
    content_type:     { type: DataTypes.STRING(50), allowNull: true },
    status:           { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'draft' },
    published_at:     { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'WebsiteSlot',
    tableName: 'website_slots', underscored: true,
    paranoid: true,
  });
  return WebsiteSlot;
};
