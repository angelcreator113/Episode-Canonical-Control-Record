'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Universe = sequelize.define('Universe', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    core_themes: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    world_rules: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pnos_beliefs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    narrative_economy: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'universes',
    timestamps: true,
    underscored: true,
  });

  Universe.associate = (models) => {
    Universe.hasMany(models.BookSeries, {
      foreignKey: 'universe_id',
      as: 'series',
    });
    if (models.Show) {
      Universe.hasMany(models.Show, {
        foreignKey: 'universe_id',
        as: 'shows',
      });
    }
  };

  return Universe;
};
