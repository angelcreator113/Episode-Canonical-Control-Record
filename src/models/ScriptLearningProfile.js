module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const ScriptLearningProfile = sequelize.define('ScriptLearningProfile', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: DataTypes.UUID,
    profile_data: DataTypes.JSON,
    created_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
  }, { tableName: 'script_learning_profiles', timestamps: false });

  return ScriptLearningProfile;
};
