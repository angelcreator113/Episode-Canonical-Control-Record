'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class StoryClockMarker extends Model {
    static associate(models) {
      StoryClockMarker.hasMany(models.StoryCalendarEvent, {
        foreignKey: 'story_position',
        as: 'events',
      });
    }
  }
  StoryClockMarker.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    name: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    calendar_date: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
    sequence_order: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    is_present: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    series_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName:   'StoryClockMarker',
    tableName:   'story_clock_markers',
    underscored: true,
    paranoid:    false,
  });
  return StoryClockMarker;
};
