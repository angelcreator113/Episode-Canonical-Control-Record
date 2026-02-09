module.exports = (sequelize, DataTypes) => {
  const ShowConfig = sequelize.define('ShowConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    target_duration: {
      type: DataTypes.INTEGER,
      defaultValue: 600,
      comment: 'Target episode duration in seconds'
    },
    target_scene_count: {
      type: DataTypes.INTEGER,
      defaultValue: 7
    },
    format: {
      type: DataTypes.STRING(100),
      defaultValue: 'YouTube long-form'
    },
    niche_category: {
      type: DataTypes.STRING(100),
      defaultValue: 'general'
    },
    content_specs: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'show_configs',
    underscored: true,
    timestamps: true
  });

  ShowConfig.associate = (models) => {
    ShowConfig.belongsTo(models.Show, { foreignKey: 'show_id' });
  };

  return ShowConfig;
};
