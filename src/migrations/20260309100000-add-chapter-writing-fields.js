'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('storyteller_chapters');
    if (!cols.tone) {
      await queryInterface.addColumn('storyteller_chapters', 'tone', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!cols.setting) {
      await queryInterface.addColumn('storyteller_chapters', 'setting', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!cols.conflict) {
      await queryInterface.addColumn('storyteller_chapters', 'conflict', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!cols.stakes) {
      await queryInterface.addColumn('storyteller_chapters', 'stakes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!cols.hooks) {
      await queryInterface.addColumn('storyteller_chapters', 'hooks', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('storyteller_chapters', 'tone').catch(() => {});
    await queryInterface.removeColumn('storyteller_chapters', 'setting').catch(() => {});
    await queryInterface.removeColumn('storyteller_chapters', 'conflict').catch(() => {});
    await queryInterface.removeColumn('storyteller_chapters', 'stakes').catch(() => {});
    await queryInterface.removeColumn('storyteller_chapters', 'hooks').catch(() => {});
  },
};
