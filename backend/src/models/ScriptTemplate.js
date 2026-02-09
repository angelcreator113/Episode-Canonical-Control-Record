module.exports = (sequelize, DataTypes) => {
  const ScriptTemplate = sequelize.define('ScriptTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    template_content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    variables: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    scene_structure: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    learning_metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'script_templates',
    underscored: true,
    timestamps: true
  });

  ScriptTemplate.associate = (models) => {
    ScriptTemplate.belongsTo(models.Show, { foreignKey: 'show_id' });
  };

  return ScriptTemplate;
};
