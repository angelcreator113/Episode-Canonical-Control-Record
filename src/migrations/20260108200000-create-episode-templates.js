'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('episode_templates', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '',
      },
      default_status: {
        type: Sequelize.ENUM('draft', 'published', 'archived', 'pending'),
        defaultValue: 'draft',
        allowNull: false,
      },
      default_categories: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false,
      },
      default_duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      config: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      icon: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: '📺',
      },
      color: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: '#667eea',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      usage_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_system_template: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Add indexes
    await queryInterface.addIndex('episode_templates', ['name'], {
      unique: true,
      where: { deleted_at: null },
      name: 'episode_templates_name_unique',
    });

    await queryInterface.addIndex('episode_templates', ['slug'], {
      unique: true,
      where: { deleted_at: null },
      name: 'episode_templates_slug_unique',
    });

    await queryInterface.addIndex('episode_templates', ['is_active'], {
      name: 'episode_templates_is_active_idx',
    });

    await queryInterface.addIndex('episode_templates', ['is_default'], {
      name: 'episode_templates_is_default_idx',
    });

    await queryInterface.addIndex('episode_templates', ['sort_order'], {
      name: 'episode_templates_sort_order_idx',
    });

    await queryInterface.addIndex('episode_templates', ['created_by'], {
      name: 'episode_templates_created_by_idx',
    });

    await queryInterface.addIndex('episode_templates', ['usage_count'], {
      name: 'episode_templates_usage_count_idx',
    });

    // Insert default system templates
    await queryInterface.bulkInsert('episode_templates', [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Standard Episode',
        slug: 'standard-episode',
        description: 'Default template for regular episodes',
        default_status: 'draft',
        default_categories: JSON.stringify(['general']),
        default_duration: 30,
        config: JSON.stringify({}),
        icon: '📺',
        color: '#667eea',
        sort_order: 1,
        usage_count: 0,
        is_active: true,
        is_default: true,
        is_system_template: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Fashion Show',
        slug: 'fashion-show',
        description: 'Template for fashion and style episodes',
        default_status: 'draft',
        default_categories: JSON.stringify(['fashion', 'style']),
        default_duration: 45,
        config: JSON.stringify({}),
        icon: '👗',
        color: '#ec4899',
        sort_order: 2,
        usage_count: 0,
        is_active: true,
        is_default: false,
        is_system_template: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Tutorial',
        slug: 'tutorial',
        description: 'Template for how-to and tutorial content',
        default_status: 'draft',
        default_categories: JSON.stringify(['tutorial', 'education']),
        default_duration: 20,
        config: JSON.stringify({}),
        icon: '🎓',
        color: '#10b981',
        sort_order: 3,
        usage_count: 0,
        is_active: true,
        is_default: false,
        is_system_template: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log('✅ episode_templates table created with default templates');
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('episode_templates');
  },
};