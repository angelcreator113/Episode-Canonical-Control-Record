'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorldStateSnapshot = sequelize.define('WorldStateSnapshot', {
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
    snapshot_label: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    character_states: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    relationship_states: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    active_threads: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    // A list of facts (strings, or { fact }), checked by migration
    // 20261004140000; the world temperature is metadata.world_temperature
    // (services/worldFacts.js).
    world_facts: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    timeline_position: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  }, {
    tableName: 'world_state_snapshots',
    timestamps: true,
    underscored: true,
  });

  return WorldStateSnapshot;
};
