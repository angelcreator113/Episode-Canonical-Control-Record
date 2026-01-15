const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Show = sequelize.define('Show', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    icon: {
      type: DataTypes.STRING,
      defaultValue: '📺',
    },
    color: {
      type: DataTypes.STRING,
      defaultValue: '#667eea',
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'coming_soon'),
      defaultValue: 'active',
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  }, {
    tableName: 'shows',
    timestamps: true,
    underscored: true,
  });

  // Associations
  Show.associate = (models) => {
    Show.hasMany(models.Episode, {
      foreignKey: 'show_id',
      as: 'episodes',
    });
  };

  return Show;
};