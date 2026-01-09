'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('episode_templates', [
      {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Product Review',
        slug: 'product-review',
        description: 'Template for product review episodes',
        default_status: 'draft',
        default_categories: JSON.stringify(['review', 'shopping']),
        default_duration: 25,
        config: JSON.stringify({}),
        icon: '🛍️',
        color: '#f59e0b',
        sort_order: 4,
        usage_count: 0,
        is_active: true,
        is_default: false,
        is_system_template: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'Behind The Scenes',
        slug: 'behind-the-scenes',
        description: 'Template for BTS and making-of content',
        default_status: 'draft',
        default_categories: JSON.stringify(['bts', 'behind-the-scenes']),
        default_duration: 15,
        config: JSON.stringify({}),
        icon: '🎬',
        color: '#8b5cf6',
        sort_order: 5,
        usage_count: 0,
        is_active: true,
        is_default: false,
        is_system_template: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('episode_templates', {
      id: [
        '00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000005',
      ],
    });
  },
};