module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const ScriptEditHistory = sequelize.define('ScriptEditHistory', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    script_id: DataTypes.UUID,
    edit_data: DataTypes.JSON,
    created_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'script_edit_history', timestamps: false });

  return ScriptEditHistory;
};
