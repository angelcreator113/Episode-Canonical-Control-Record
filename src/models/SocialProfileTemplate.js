'use strict';

module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const SocialProfileTemplate = sequelize.define('SocialProfileTemplate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    template_data: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    usage_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'social_profile_templates',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return SocialProfileTemplate;
};
