'use strict';

const TABLES = [
  'franchise_tech_knowledge',
  'session_briefs',
  'post_generation_reviews',
  'writing_rhythm',
  'writing_goals',
  'multi_product_content',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      const desc = await queryInterface.describeTable(table);
      if (!desc.deleted_at) {
        await queryInterface.addColumn(table, 'deleted_at', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null,
        });
      }
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      const desc = await queryInterface.describeTable(table);
      if (desc.deleted_at) {
        await queryInterface.removeColumn(table, 'deleted_at');
      }
    }
  },
};
