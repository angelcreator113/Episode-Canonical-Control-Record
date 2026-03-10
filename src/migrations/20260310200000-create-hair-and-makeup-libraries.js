'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── hair_library table ────────────────────────────────────────────
    await queryInterface.createTable('hair_library', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
      },
      vibe_tags: {
        type: Sequelize.JSONB,
        defaultValue: [],
      },
      occasion_tags: {
        type: Sequelize.JSONB,
        defaultValue: [],
      },
      event_types: {
        type: Sequelize.JSONB,
        defaultValue: [],
      },
      reference_photo_url: {
        type: Sequelize.STRING,
      },
      color_state: {
        type: Sequelize.STRING,
      },
      length: {
        type: Sequelize.STRING,
      },
      texture: {
        type: Sequelize.STRING,
      },
      career_echo_potential: {
        type: Sequelize.TEXT,
      },
      is_justAWoman_style: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('hair_library', ['show_id']);

    // ── makeup_library table ──────────────────────────────────────────
    await queryInterface.createTable('makeup_library', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
      },
      mood_tag: {
        type: Sequelize.STRING,
      },
      occasion_tags: {
        type: Sequelize.JSONB,
        defaultValue: [],
      },
      event_types: {
        type: Sequelize.JSONB,
        defaultValue: [],
      },
      aesthetic_tags: {
        type: Sequelize.JSONB,
        defaultValue: [],
      },
      skin_finish: {
        type: Sequelize.STRING,
      },
      eye_look: {
        type: Sequelize.STRING,
      },
      lip_look: {
        type: Sequelize.STRING,
      },
      reference_photo_url: {
        type: Sequelize.STRING,
      },
      career_echo_potential: {
        type: Sequelize.TEXT,
      },
      is_justAWoman_style: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      featured_brand: {
        type: Sequelize.STRING,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('makeup_library', ['show_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('makeup_library');
    await queryInterface.dropTable('hair_library');
  },
};
