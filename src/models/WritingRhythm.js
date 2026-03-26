'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WritingRhythm extends Model {
    static associate(_models) {}
  }
  WritingRhythm.init({
    id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    session_date:     { type: DataTypes.DATEONLY, allowNull: false },
    scenes_proposed:  { type: DataTypes.INTEGER, defaultValue: 0 },
    scenes_generated: { type: DataTypes.INTEGER, defaultValue: 0 },
    scenes_approved:  { type: DataTypes.INTEGER, defaultValue: 0 },
    words_written:    { type: DataTypes.INTEGER, defaultValue: 0 },
    arc_stage:        { type: DataTypes.STRING(30), allowNull: true },
    session_note:     { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'WritingRhythm',
    tableName: 'writing_rhythm', underscored: true,
  });
  return WritingRhythm;
};
