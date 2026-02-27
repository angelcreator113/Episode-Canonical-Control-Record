// src/migrations/20260224600000-add-voice-type-to-lines.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // voice_type on storyteller_lines
    // narrator | interior | dialogue | lala | unattributed
    await queryInterface.addColumn('storyteller_lines', 'voice_type', {
      type:         Sequelize.STRING(50),
      defaultValue: 'unattributed',
      allowNull:    true,
    });

    // voice_confidence — 0.0 to 1.0, how sure the AI is
    await queryInterface.addColumn('storyteller_lines', 'voice_confidence', {
      type:     Sequelize.FLOAT,
      allowNull: true,
    });

    // voice_confirmed — author accepted the attribution
    await queryInterface.addColumn('storyteller_lines', 'voice_confirmed', {
      type:         Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('storyteller_lines', 'voice_type');
    await queryInterface.removeColumn('storyteller_lines', 'voice_confidence');
    await queryInterface.removeColumn('storyteller_lines', 'voice_confirmed');
  },
};
