'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContinuityCharacter = sequelize.define('ContinuityCharacter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    timeline_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    character_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '#5b7fff',
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'continuity_characters',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
  });

  ContinuityCharacter.associate = (models) => {
    ContinuityCharacter.belongsTo(models.ContinuityTimeline, { foreignKey: 'timeline_id', as: 'timeline' });
    ContinuityCharacter.belongsToMany(models.ContinuityBeat, {
      through: models.ContinuityBeatCharacter,
      foreignKey: 'character_id',
      otherKey: 'beat_id',
      as: 'beats',
    });
  };

  return ContinuityCharacter;
};
