// ─── PulseStoryline.js ───────────────────────────────────────────────────────
// A storyline on The Pulse (migration 20261012090000; Task #2989; The Pulse
// spec §4): a plan of posts across story moments that plants and pays off a
// thread. It may follow one of the show's threads (show_story_thread_id),
// never copying it (services/pulseStorylines.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseStoryline extends Model {
    static associate(_models) {}
  }
  PulseStoryline.init({
    id:                   { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:              { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    title:                { type: DataTypes.STRING(200), allowNull: false },
    premise:              { type: DataTypes.TEXT, allowNull: true },
    show_story_thread_id: { type: DataTypes.UUID, allowNull: true },
    status:               { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'planned' }, // planned | running | paid_off | dropped
  }, {
    sequelize, modelName: 'PulseStoryline',
    tableName: 'pulse_storylines', underscored: true,
    paranoid: true,
  });
  return PulseStoryline;
};
