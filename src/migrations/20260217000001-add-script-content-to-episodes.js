'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('episodes');
    if (!tableDesc.script_content) {
      await queryInterface.addColumn('episodes', 'script_content', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      console.log('✅ Added script_content column to episodes table');
    } else {
      console.log('script_content already exists, skipping');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('episodes', 'script_content');
  }
};
