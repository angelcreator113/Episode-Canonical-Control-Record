module.exports = (sequelize, DataTypes) => {
  const ScriptEditHistory = sequelize.define('ScriptEditHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    episode_id: {
      type: DataTypes.UUID
    },
    script_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    edit_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'word_change, deletion, addition, reorder'
    },
    variable_affected: {
      type: DataTypes.STRING(100)
    },
    original_value: {
      type: DataTypes.TEXT
    },
    final_value: {
      type: DataTypes.TEXT
    },
    user_reasoning: {
      type: DataTypes.TEXT
    },
    ai_learning_note: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'script_edit_history',
    underscored: true,
    timestamps: false
  });

  ScriptEditHistory.associate = (models) => {
    ScriptEditHistory.belongsTo(models.Episode, { foreignKey: 'episode_id' });
  };

  return ScriptEditHistory;
};
