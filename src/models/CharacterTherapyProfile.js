const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  return sequelize.define('CharacterTherapyProfile', {
    id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    character_id:        { type: DataTypes.UUID, allowNull: false },
    emotional_state:     { type: DataTypes.JSONB, defaultValue: {} },
    baseline:            { type: DataTypes.JSONB, defaultValue: {} },
    known:               { type: DataTypes.JSONB, defaultValue: [] },
    sensed:              { type: DataTypes.JSONB, defaultValue: [] },
    never_knows:         { type: DataTypes.JSONB, defaultValue: [] },
    deja_vu_events:      { type: DataTypes.JSONB, defaultValue: [] },
    primary_defense:     { type: DataTypes.STRING, defaultValue: 'rationalize' },
    sessions_completed:  { type: DataTypes.INTEGER, defaultValue: 0 },
    session_log_history: { type: DataTypes.JSONB, defaultValue: [] },
  }, {
    tableName: 'character_therapy_profiles',
    timestamps: true,
    underscored: true,
  });
};
