'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('shows', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        comment: 'Unique show identifier',
      },
      
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Show name',
      },
      
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Show description/synopsis',
      },
      
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'URL-friendly show identifier',
      },
      
      genre: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Show genre (comma-separated)',
      },
      
      status: {
        type: Sequelize.ENUM('active', 'archived', 'cancelled', 'in_development'),
        defaultValue: 'active',
        allowNull: false,
        comment: 'Current show status',
      },
      
      creator_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Creator or producer name',
      },
      
      network: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Network or platform name',
      },
      
      episode_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total number of episodes',
      },
      
      season_count: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: 'Number of seasons',
      },
      
      premiere_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Show premiere date',
      },
      
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional metadata (ratings, awards, etc)',
      },
      
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether the show is active',
      },
      
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp',
      },
    }, {
      indexes: [
        {
          fields: ['slug'],
          unique: true,
        },
        {
          fields: ['status'],
        },
        {
          fields: ['is_active'],
        },
        {
          fields: ['created_at'],
        },
      ],
    });
  },

  async down (queryInterface, _Sequelize) {
    await queryInterface.dropTable('shows');
  }
};
