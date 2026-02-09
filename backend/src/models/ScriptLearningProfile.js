module.exports = (sequelize, DataTypes) => {
  const ScriptLearningProfile = sequelize.define('ScriptLearningProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    vocabulary_data: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    pacing_data: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    structure_data: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    niche_specifics: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    confidence_scores: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    training_episodes_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_trained: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'script_learning_profiles',
    underscored: true,
    timestamps: true
  });

  ScriptLearningProfile.associate = (models) => {
    ScriptLearningProfile.belongsTo(models.Show, { foreignKey: 'show_id' });
  };

  return ScriptLearningProfile;
};
