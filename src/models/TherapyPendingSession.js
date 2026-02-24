'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('TherapyPendingSession', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  character_id:        DataTypes.UUID,
  character_name:      DataTypes.STRING,
  character_slug:      DataTypes.STRING,
  character_type:      DataTypes.STRING,
  knock_message:       DataTypes.TEXT,
  wound:               DataTypes.TEXT,
  emotional_state:     DataTypes.JSONB,
  trigger_dimension:   DataTypes.STRING,
  trigger_value:       DataTypes.INTEGER,
  status:              { type: DataTypes.STRING, defaultValue: 'waiting' },
}, { tableName: 'therapy_pending_sessions', timestamps: true, underscored: true });
