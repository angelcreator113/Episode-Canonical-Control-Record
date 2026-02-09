module.exports = (sequelize, DataTypes) => {
  const ScriptSuggestion = sequelize.define('ScriptSuggestion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    episode_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    variable_key: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    suggested_value: {
      type: DataTypes.TEXT
    },
    context_used: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    confidence_score: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.5
    },
    user_accepted: {
      type: DataTypes.BOOLEAN
    },
    user_final_value: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'script_suggestions',
    underscored: true,
    timestamps: true
  });

  ScriptSuggestion.associate = (models) => {
    ScriptSuggestion.belongsTo(models.Episode, { foreignKey: 'episode_id' });
  };

  return ScriptSuggestion;
};
