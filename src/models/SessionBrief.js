'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SessionBrief extends Model {
    static associate(models) {}
  }
  SessionBrief.init({
    id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    brief_text:     { type: DataTypes.TEXT, allowNull: false },
    tech_snapshot:  { type: DataTypes.JSONB, allowNull: true },
    story_snapshot: { type: DataTypes.JSONB, allowNull: true },
    pending_builds: { type: DataTypes.JSONB, allowNull: true },
    generated_at:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    used_at:        { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'SessionBrief',
    tableName: 'session_briefs', underscored: true,
  });
  return SessionBrief;
};
