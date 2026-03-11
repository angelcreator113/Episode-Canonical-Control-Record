'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AmberScanRun extends Model {
    static associate(models) {
      AmberScanRun.hasMany(models.AmberFinding, { foreignKey: 'scan_run_id', as: 'findings' });
    }
  }

  AmberScanRun.init({
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    trigger:        { type: DataTypes.STRING, allowNull: false },
    status:         { type: DataTypes.STRING, defaultValue: 'running' },
    findings_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    critical_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    checks_run:     { type: DataTypes.JSONB },
    duration_ms:    { type: DataTypes.INTEGER },
    error:          { type: DataTypes.TEXT },
  }, {
    sequelize,
    modelName:   'AmberScanRun',
    tableName:   'amber_scan_runs',
    underscored: true,
    paranoid:    false,
  });

  return AmberScanRun;
};
