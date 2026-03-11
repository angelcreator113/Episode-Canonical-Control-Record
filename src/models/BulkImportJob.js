'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BulkImportJob extends Model {}

  BulkImportJob.init({
    id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    status:            { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
    total:             { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    completed:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    failed:            { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    candidates:        { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    results:           { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    character_context: { type: DataTypes.JSONB, allowNull: true },
    character_key:     { type: DataTypes.STRING(100), allowNull: true },
    series_id:         { type: DataTypes.INTEGER, allowNull: true },
    error_message:     { type: DataTypes.TEXT, allowNull: true },
    started_at:        { type: DataTypes.DATE, allowNull: true },
    completed_at:      { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize,
    modelName:  'BulkImportJob',
    tableName:  'bulk_import_jobs',
    underscored: true,
    paranoid: false,
  });

  return BulkImportJob;
};
