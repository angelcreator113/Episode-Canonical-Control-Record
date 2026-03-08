'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BrainFingerprint extends Model {
    static associate(models) {}
  }
  BrainFingerprint.init({
    id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    brain_type: {
      type: DataTypes.ENUM('story', 'tech', 'show', 'voice'),
      allowNull: false,
    },
    series_id:       { type: DataTypes.INTEGER, allowNull: true },
    entry_id:        { type: DataTypes.INTEGER, allowNull: false },
    content_hash:    { type: DataTypes.STRING(64), allowNull: false },
    title_hash:      { type: DataTypes.STRING(64), allowNull: true },
    source_document: { type: DataTypes.STRING(200), allowNull: true },
    source_version:  { type: DataTypes.STRING(20), allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'superseded', 'duplicate_blocked'),
      defaultValue: 'active',
    },
    superseded_by:   { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'BrainFingerprint', tableName: 'brain_fingerprints', underscored: true });
  return BrainFingerprint;
};
