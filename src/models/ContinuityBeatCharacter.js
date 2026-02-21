'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContinuityBeatCharacter = sequelize.define('ContinuityBeatCharacter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    beat_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    character_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  }, {
    tableName: 'continuity_beat_characters',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,   // join table only has created_at
  });

  return ContinuityBeatCharacter;
};
