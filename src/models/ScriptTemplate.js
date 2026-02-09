module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const ScriptTemplate = sequelize.define('ScriptTemplate', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: DataTypes.STRING,
    content: DataTypes.TEXT,
    created_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'script_templates', timestamps: false });

  return ScriptTemplate;
};
