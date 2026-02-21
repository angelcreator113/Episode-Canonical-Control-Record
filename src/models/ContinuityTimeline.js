'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContinuityTimeline = sequelize.define('ContinuityTimeline', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Untitled Timeline',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    season_tag: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'locked'),
      defaultValue: 'draft',
    },
  }, {
    tableName: 'continuity_timelines',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
  });

  ContinuityTimeline.associate = (models) => {
    ContinuityTimeline.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
    ContinuityTimeline.hasMany(models.ContinuityCharacter, { foreignKey: 'timeline_id', as: 'characters', onDelete: 'CASCADE' });
    ContinuityTimeline.hasMany(models.ContinuityBeat, { foreignKey: 'timeline_id', as: 'beats', onDelete: 'CASCADE' });
  };

  return ContinuityTimeline;
};
