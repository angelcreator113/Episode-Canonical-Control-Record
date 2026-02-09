module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const ScriptSuggestion = sequelize.define('ScriptSuggestion', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    script_id: DataTypes.UUID,
    suggestion_text: DataTypes.TEXT,
    created_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'script_suggestions', timestamps: false });

  return ScriptSuggestion;
};
