'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CalendarEventAttendee extends Model {
    static associate(models) {
      CalendarEventAttendee.belongsTo(models.StoryCalendarEvent, {
        foreignKey: 'event_id',
        as: 'event',
      });
      CalendarEventAttendee.belongsTo(models.RegistryCharacter, {
        foreignKey: 'character_id',
        as: 'character',
      });
    }
  }
  CalendarEventAttendee.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    event_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    character_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    feed_profile_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    attendee_type: {
      type: DataTypes.ENUM('confirmed', 'no_show', 'uninvited_arrival', 'watched_live', 'heard_about_it'),
      allowNull: false,
    },
    knew_about_event_before: {
      type:      DataTypes.BOOLEAN,
      allowNull: true,
    },
    left_early: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    what_they_experienced: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    author_note: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName:   'CalendarEventAttendee',
    tableName:   'calendar_event_attendees',
    underscored: true,
    paranoid:    false,
    timestamps:  true,
    updatedAt:   false,
  });
  return CalendarEventAttendee;
};
