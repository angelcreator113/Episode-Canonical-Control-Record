/**
 * Migration: Add show_id to episodes table
 * Adds foreign key relationship between episodes and shows
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('episodes', 'show_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'shows',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add index for better query performance
    await queryInterface.addIndex('episodes', ['show_id'], {
      name: 'idx_episodes_show_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('episodes', 'idx_episodes_show_id');
    await queryInterface.removeColumn('episodes', 'show_id');
  },
};
