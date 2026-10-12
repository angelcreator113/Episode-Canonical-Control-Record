// ─── PulsePollVote.js ────────────────────────────────────────────────────────
// One audience vote (migration 20261012100000; Task #3005): the option, and
// the voter's cookie id and IP each hashed with POLL_HASH_SALT, never raw.
// One per poll per cookie and per IP (unique indexes).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PulsePollVote extends Model {
    static associate(_models) {}
  }
  PulsePollVote.init({
    id:         { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    poll_id:    { type: DataTypes.UUID, allowNull: false, references: { model: 'pulse_polls', key: 'id' } },
    option_id:  { type: DataTypes.UUID, allowNull: false, references: { model: 'pulse_poll_options', key: 'id' } },
    voter_hash: { type: DataTypes.STRING(64), allowNull: false },
    ip_hash:    { type: DataTypes.STRING(64), allowNull: false },
  }, {
    sequelize, modelName: 'PulsePollVote',
    tableName: 'pulse_poll_votes', underscored: true,
    paranoid: true,
  });
  return PulsePollVote;
};
