'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('book_series', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      universe_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'universes', key: 'id' },
        onDelete: 'CASCADE',
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'shows', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Optional — series may expand a specific show',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'e.g. Becoming Prime',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What story does this series tell? Emotional focus, timeline.',
      },
      order_index: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Order within the universe',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('book_series', ['universe_id'], {
      name: 'book_series_universe_id_idx',
    });
    await queryInterface.addIndex('book_series', ['show_id'], {
      name: 'book_series_show_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('book_series');
  },
};
