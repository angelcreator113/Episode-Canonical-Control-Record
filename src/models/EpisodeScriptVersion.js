// ─── EpisodeScriptVersion.js ─────────────────────────────────────────────────
// A script the Script tab replaced (migration 20261015100000; Script tab
// audit, 2026-10-15): the episode, the text and locked beats as they were,
// what replaced it (save | lock | restore | generate) and who. Kept per
// episode (services/scriptVersions.js): the newest 50 of save, lock and
// restore, and the newest 10 generated. 'restore' is the script a save
// putting back a version from History replaced (History audit, 2026-10-24).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EpisodeScriptVersion extends Model {
    static associate(_models) {}
  }
  EpisodeScriptVersion.init({
    id:                  { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    episode_id:          { type: DataTypes.UUID, allowNull: false, references: { model: 'episodes', key: 'id' } },
    script_content:      { type: DataTypes.TEXT, allowNull: false },
    script_locked_beats: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    source:              { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'save' },
    created_by:          { type: DataTypes.STRING(255), allowNull: true },
  }, {
    sequelize, modelName: 'EpisodeScriptVersion',
    tableName: 'episode_script_versions', underscored: true,
    paranoid: true,
  });
  return EpisodeScriptVersion;
};
