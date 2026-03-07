// models/SessionBrief.js
// Session briefs — pre-session context snapshots for writing sessions

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SessionBrief = sequelize.define('SessionBrief', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    episode_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    brief_type: {
      type: DataTypes.ENUM('writing', 'editing', 'review', 'planning'),
      allowNull: false,
      defaultValue: 'writing',
    },
    context_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    goals: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    session_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    session_ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('preparing', 'active', 'completed', 'abandoned'),
      defaultValue: 'preparing',
    },
  }, {
    tableName: 'session_briefs',
    underscored: true,
    timestamps: true,
  });

  return SessionBrief;
};
