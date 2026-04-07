'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class StoryCalendarEvent extends Model {
    static associate(models) {
      StoryCalendarEvent.belongsTo(models.StoryClockMarker, {
        foreignKey: 'story_position',
        as: 'marker',
      });
      StoryCalendarEvent.hasMany(models.CalendarEventAttendee, {
        foreignKey: 'event_id',
        as: 'attendees',
      });
      StoryCalendarEvent.hasMany(models.CalendarEventRipple, {
        foreignKey: 'event_id',
        as: 'ripples',
      });
      StoryCalendarEvent.belongsTo(models.StorytellerLine, {
        foreignKey: 'source_line_id',
        as: 'sourceLine',
      });
      // NOTE: location_id + source_calendar_event_id associations disabled
      // until migrations 20260710/20260711 are confirmed run.
      // Re-enable: belongsTo WorldLocation as 'location',
      // hasMany WorldEvent as 'spawnedEvents'
    }
  }
  StoryCalendarEvent.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    title: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    event_type: {
      type: DataTypes.ENUM('world_event', 'story_event', 'character_event', 'lalaverse_cultural'),
      allowNull: false,
    },
    start_datetime: {
      type:      DataTypes.DATE,
      allowNull: false,
    },
    end_datetime: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
    is_recurring: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    recurrence_pattern: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
    // NOTE: location_id added by migration 20260710 — not defined here
    // to prevent crashes if migration hasn't run
    location_name: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
    location_address: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    lalaverse_district: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
    visibility: {
      type:         DataTypes.ENUM('public', 'private', 'underground'),
      defaultValue: 'public',
    },
    what_world_knows: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    what_only_we_know: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    logged_by: {
      type: DataTypes.ENUM('evoni', 'amber', 'system'),
      allowNull: true,
    },
    source_line_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    story_position: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    series_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
    /* ─── cultural calendar fields ─── */
    severity_level: {
      type:      DataTypes.STRING(50),
      allowNull: true,
    },
    cultural_category: {
      type:      DataTypes.STRING(100),
      allowNull: true,
    },
    activities: {
      type:      DataTypes.JSONB,
      allowNull: true,
    },
    phrases: {
      type:      DataTypes.JSONB,
      allowNull: true,
    },
    is_micro_event: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName:   'StoryCalendarEvent',
    tableName:   'story_calendar_events',
    underscored: true,
    paranoid:    false,
  });
  return StoryCalendarEvent;
};
