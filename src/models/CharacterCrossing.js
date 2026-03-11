'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CharacterCrossing extends Model {
    static associate(models) {
      CharacterCrossing.belongsTo(models.RegistryCharacter, {
        foreignKey: 'character_id',
        as: 'character',
      });
      CharacterCrossing.belongsTo(models.StoryClockMarker, {
        foreignKey: 'crossing_date',
        as: 'marker',
      });
      CharacterCrossing.belongsTo(models.StoryCalendarEvent, {
        foreignKey: 'calendar_event_id',
        as: 'calendarEvent',
      });
    }
  }
  CharacterCrossing.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    character_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    crossing_date: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    calendar_event_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    trigger: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    initial_feed_state: {
      type:      DataTypes.STRING(100),
      allowNull: true,
    },
    performance_gap_score: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    gap_proposed_by_amber: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    gap_confirmed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName:   'CharacterCrossing',
    tableName:   'character_crossings',
    underscored: true,
    paranoid:    false,
  });
  return CharacterCrossing;
};
