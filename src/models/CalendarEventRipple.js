'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CalendarEventRipple extends Model {
    static associate(models) {
      CalendarEventRipple.belongsTo(models.StoryCalendarEvent, {
        foreignKey: 'event_id',
        as: 'event',
      });
      CalendarEventRipple.belongsTo(models.RegistryCharacter, {
        foreignKey: 'affected_character_id',
        as: 'affectedCharacter',
      });
    }
  }
  CalendarEventRipple.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    event_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    affected_character_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    affected_feed_profile_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    ripple_type: {
      type: DataTypes.ENUM('witnessed', 'heard_secondhand', 'affected_by_outcome', 'doesnt_know_yet'),
      allowNull: false,
    },
    deep_profile_dimension: {
      type: DataTypes.ENUM(
        'ambition', 'desire', 'visibility', 'grief',
        'class', 'body', 'habits', 'belonging'
      ),
      allowNull: true,
    },
    intensity: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    proposed_thread: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    thread_confirmed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName:   'CalendarEventRipple',
    tableName:   'calendar_event_ripples',
    underscored: true,
    paranoid:    false,
    timestamps:  true,
    updatedAt:   false,
  });
  return CalendarEventRipple;
};
