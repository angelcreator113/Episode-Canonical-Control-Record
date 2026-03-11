'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AmberFinding extends Model {
    static associate(models) {
      AmberFinding.belongsTo(models.AmberScanRun, { foreignKey: 'scan_run_id', as: 'scanRun' });
    }
  }

  AmberFinding.init({
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type:                  { type: DataTypes.STRING, allowNull: false },
    severity:              { type: DataTypes.STRING, defaultValue: 'medium' },
    title:                 { type: DataTypes.STRING, allowNull: false },
    description:           { type: DataTypes.TEXT },
    evidence:              { type: DataTypes.TEXT },
    affected_file:         { type: DataTypes.STRING },
    affected_route:        { type: DataTypes.STRING },
    affected_table:        { type: DataTypes.STRING },
    affected_page:         { type: DataTypes.STRING },
    proposed_fix:          { type: DataTypes.TEXT },
    proposed_diff:         { type: DataTypes.TEXT },
    fix_confidence:        { type: DataTypes.INTEGER },
    fix_category:          { type: DataTypes.STRING },
    auto_approve_eligible: { type: DataTypes.BOOLEAN, defaultValue: false },
    auto_approve_category: { type: DataTypes.STRING },
    status:                { type: DataTypes.STRING, defaultValue: 'detected' },
    execution_log:         { type: DataTypes.TEXT },
    execution_result:      { type: DataTypes.JSONB },
    applied_at:            { type: DataTypes.DATE },
    applied_diff:          { type: DataTypes.TEXT },
    amber_verdict:         { type: DataTypes.TEXT },
    surfaced_in_chat:      { type: DataTypes.BOOLEAN, defaultValue: false },
    urgent:                { type: DataTypes.BOOLEAN, defaultValue: false },
    detected_by:           { type: DataTypes.STRING, defaultValue: 'diagnostic_scan' },
    scan_run_id:           { type: DataTypes.UUID },
  }, {
    sequelize,
    modelName:   'AmberFinding',
    tableName:   'amber_findings',
    underscored: true,
    paranoid:    false,
  });

  return AmberFinding;
};
