'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('storyteller_chapters', 'question_direction', {
      type: Sequelize.STRING(20), allowNull: true,
      // 'toward' | 'away' | 'holding' | null
    });
    await queryInterface.addColumn('storyteller_chapters', 'exit_emotion', {
      type: Sequelize.STRING(50), allowNull: true,
    });
    await queryInterface.addColumn('storyteller_chapters', 'exit_emotion_note', {
      type: Sequelize.TEXT, allowNull: true,
    });
    await queryInterface.addColumn('storyteller_chapters', 'emotional_temperature', {
      type: Sequelize.INTEGER, allowNull: true,
      // 1 (Still) | 2 (Low) | 3 (Medium) | 4 (High) | 5 (Peak)
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('storyteller_chapters', 'question_direction');
    await queryInterface.removeColumn('storyteller_chapters', 'exit_emotion');
    await queryInterface.removeColumn('storyteller_chapters', 'exit_emotion_note');
    await queryInterface.removeColumn('storyteller_chapters', 'emotional_temperature');
  },
};
