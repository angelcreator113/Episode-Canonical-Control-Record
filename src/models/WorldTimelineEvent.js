'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorldTimelineEvent = sequelize.define('WorldTimelineEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    universe_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    book_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    event_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    event_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    story_date: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    event_type: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'plot', // plot, backstory, world, character, relationship
    },
    characters_involved: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    location_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    impact_level: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: 'minor', // minor, moderate, major, catastrophic
    },
    consequences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    is_canon: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  }, {
    tableName: 'world_timeline_events',
    timestamps: true,
    underscored: true,
  });

  WorldTimelineEvent.associate = (models) => {
    if (models.Universe) {
      WorldTimelineEvent.belongsTo(models.Universe, {
        foreignKey: 'universe_id',
        as: 'universe',
      });
    }
    if (models.WorldLocation) {
      WorldTimelineEvent.belongsTo(models.WorldLocation, {
        foreignKey: 'location_id',
        as: 'location',
      });
    }
  };

  return WorldTimelineEvent;
};
