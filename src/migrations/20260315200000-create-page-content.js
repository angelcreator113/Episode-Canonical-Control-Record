'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('page_content', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      page_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      constant_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('page_content', ['page_name', 'constant_key'], {
      unique: true,
      name: 'page_content_page_constant_unique',
    });

    await queryInterface.addIndex('page_content', ['page_name'], {
      name: 'page_content_page_name_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('page_content');
  },
};
