module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const ShowConfig = sequelize.define('ShowConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    config_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    config_value: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
  }, {
    tableName: 'show_configs',
    timestamps: false,
  });

  return ShowConfig;
};
