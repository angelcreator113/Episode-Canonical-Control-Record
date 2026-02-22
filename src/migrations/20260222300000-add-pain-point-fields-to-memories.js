'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add pain_point specific fields to storyteller_memories
    await queryInterface.addColumn('storyteller_memories', 'category', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Pain point category: comparison_spiral | visibility_gap | identity_drift | financial_risk | consistency_collapse | clarity_deficit | external_validation | restart_cycle',
    });

    await queryInterface.addColumn('storyteller_memories', 'coaching_angle', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'What a coach would say to someone experiencing this pain point. Auto-generated. Never shown in manuscript.',
    });

    await queryInterface.addIndex('storyteller_memories', ['type', 'category'], {
      name: 'storyteller_memories_type_category_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('storyteller_memories', 'storyteller_memories_type_category_idx');
    await queryInterface.removeColumn('storyteller_memories', 'coaching_angle');
    await queryInterface.removeColumn('storyteller_memories', 'category');
  },
};
