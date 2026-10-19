// ─── MediaAssetSource.js ─────────────────────────────────────────────────────
// Visual Memory phase 4 (migration 20261019160000; services/mediaLibrary
// addSources / sourcesOf): what a made picture was made from, one row per
// reference used. role place (the place picture it keeps; not a variation),
// portrait (whose face it holds: character_id, and source_url when that
// portrait is not in the library) or parent (the picture a variation edits).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MediaAssetSource extends Model {
    static associate(_models) {}
  }
  MediaAssetSource.init({
    id:              { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    asset_id:        { type: DataTypes.UUID, allowNull: false },
    source_asset_id: { type: DataTypes.UUID, allowNull: true },
    role:            { type: DataTypes.STRING(16), allowNull: false },
    character_id:    { type: DataTypes.UUID, allowNull: true },
    source_url:      { type: DataTypes.TEXT, allowNull: true },
    created_by:      { type: DataTypes.STRING(100), allowNull: true },
  }, {
    sequelize, modelName: 'MediaAssetSource',
    tableName: 'media_asset_sources', underscored: true,
    paranoid: true,
  });
  return MediaAssetSource;
};
