const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SceneTemplate = sequelize.define(
    'SceneTemplate',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      scene_type: {
        type: DataTypes.STRING(50),
        defaultValue: 'main',
      },
      mood: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      structure: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      default_settings: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who created this template',
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this template is available to all users',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'scene_templates',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['created_by'],
        },
        {
          fields: ['is_public'],
        },
        {
          fields: ['scene_type'],
        },
      ],
    }
  );

  return SceneTemplate;
};
