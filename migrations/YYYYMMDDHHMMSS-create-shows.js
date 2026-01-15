'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('shows', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        defaultValue: '',
      },
      icon: {
        type: Sequelize.STRING,
        defaultValue: '📺',
      },
      color: {
        type: Sequelize.STRING,
        defaultValue: '#667eea',
      },
      status: {
        type: Sequelize.ENUM('active', 'archived', 'coming_soon'),
        defaultValue: 'active',
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Seed initial shows
    await queryInterface.bulkInsert('shows', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Styling Adventures with Lala',
        slug: 'styling-adventures-lala',
        description: 'Fashion and style adventures with Lala',
        icon: '👗',
        color: '#ec4899',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Day in the Life of a Content Creator',
        slug: 'day-in-life-creator',
        description: 'Behind the scenes content creation',
        icon: '🎬',
        color: '#f59e0b',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Diaries of a Dreamer (The Late Night Show)',
        slug: 'diaries-dreamer',
        description: 'Late night talk show style content',
        icon: '🌙',
        color: '#8b5cf6',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Add show_id to episodes table
    await queryInterface.addColumn('episodes', 'show_id', {
      type: Sequelize.UUID,
      references: {
        model: 'shows',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('episodes', 'show_id');
    await queryInterface.dropTable('shows');
  },
};