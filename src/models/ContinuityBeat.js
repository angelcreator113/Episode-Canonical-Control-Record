'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContinuityBeat = sequelize.define('ContinuityBeat', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    timeline_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    beat_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    time_tag: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'continuity_beats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
  });

  ContinuityBeat.associate = (models) => {
    ContinuityBeat.belongsTo(models.ContinuityTimeline, { foreignKey: 'timeline_id', as: 'timeline' });
    ContinuityBeat.belongsToMany(models.ContinuityCharacter, {
      through: models.ContinuityBeatCharacter,
      foreignKey: 'beat_id',
      otherKey: 'character_id',
      as: 'characters',
    });
  };

  return ContinuityBeat;
};
