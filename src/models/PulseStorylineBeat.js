// ─── PulseStorylineBeat.js ───────────────────────────────────────────────────
// One beat of a storyline (migration 20261012090000; Task #2989): a plant,
// build or payoff post at a story order, by a Feed profile, drafted through
// the posting queue when its moment is the present (services/pulseStorylines.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulseStorylineBeat extends Model {
    static associate(_models) {}
  }
  PulseStorylineBeat.init({
    id:                { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    storyline_id:      { type: DataTypes.UUID, allowNull: false, references: { model: 'pulse_storylines', key: 'id' } },
    show_id:           { type: DataTypes.UUID, allowNull: false, references: { model: 'shows', key: 'id' } },
    kind:              { type: DataTypes.STRING(10), allowNull: false },   // plant | build | payoff
    story_order:       { type: DataTypes.INTEGER, allowNull: false },
    poster_profile_id: { type: DataTypes.INTEGER, allowNull: false },
    brief:             { type: DataTypes.TEXT, allowNull: false },
    status:            { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'planned' }, // planned | queued | drafted | skipped
    job_id:            { type: DataTypes.UUID, allowNull: true },
    post_id:           { type: DataTypes.UUID, allowNull: true },
  }, {
    sequelize, modelName: 'PulseStorylineBeat',
    tableName: 'pulse_storyline_beats', underscored: true,
    paranoid: true,
  });
  return PulseStorylineBeat;
};
