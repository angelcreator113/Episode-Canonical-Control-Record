module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('character_therapy_profiles', {
      id:                  { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      character_id:        { type: Sequelize.UUID, allowNull: false, unique: true },
      emotional_state:     { type: Sequelize.JSONB, defaultValue: {} },
      baseline:            { type: Sequelize.JSONB, defaultValue: {} },
      known:               { type: Sequelize.JSONB, defaultValue: [] },
      sensed:              { type: Sequelize.JSONB, defaultValue: [] },
      never_knows:         { type: Sequelize.JSONB, defaultValue: [] },
      deja_vu_events:      { type: Sequelize.JSONB, defaultValue: [] },
      primary_defense:     { type: Sequelize.STRING, defaultValue: 'rationalize' },
      sessions_completed:  { type: Sequelize.INTEGER, defaultValue: 0 },
      session_log_history: { type: Sequelize.JSONB, defaultValue: [] },
      created_at:          { type: Sequelize.DATE, allowNull: false },
      updated_at:          { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('character_therapy_profiles');
  },
};
