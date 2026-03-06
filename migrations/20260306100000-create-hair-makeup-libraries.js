'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. hair_library ─────────────────────────────────────────────────────
    await queryInterface.createTable('hair_library', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'e.g. "Slicked-Back Bun", "Waist-Length Body Wave"',
      },
      vibe_tags: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: 'sleek | voluminous | protective | editorial | casual | glam',
      },
      color_state: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'e.g. "jet black", "honey blonde balayage"',
      },
      occasion_tags: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: 'gala | brunch | editorial | everyday | press | date | etc.',
      },
      reference_photo_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL of reference photo',
      },
      rendered_asset_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL of composited Lala rig asset — null until rendered',
      },
      career_echo_potential: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Links this look to a pain point, book moment, or franchise anchor',
      },
      era_alignment: {
        type: Sequelize.STRING(80),
        allowNull: true,
        comment: 'foundation | glow_up | luxury | prime | legacy',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.addIndex('hair_library', ['era_alignment']);

    // ── 2. makeup_library ────────────────────────────────────────────────────
    await queryInterface.createTable('makeup_library', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shows', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'e.g. "Velour Gala Face", "Afternoon Garden Social"',
      },
      mood_tag: {
        type: Sequelize.STRING(80),
        allowNull: true,
        comment: 'e.g. "dramatic", "soft-life", "editorial", "natural"',
      },
      occasion_tag: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: 'Primary occasion this look was created for',
      },
      event_types: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: [],
        comment: 'Compatible event types from Events Library',
      },
      reference_photo_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL of reference photo',
      },
      rendered_face_state_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL of rendered Lala face state — null until rendered',
      },
      career_echo_potential: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      era_alignment: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    // ── 3. Add event_category to world_events ────────────────────────────────
    await queryInterface.addColumn('world_events', 'event_category', {
      type: Sequelize.STRING(40),
      allowNull: true,
      defaultValue: 'industry',
      comment: 'industry | dating | family | social_drama',
    });

    await queryInterface.addIndex('world_events', ['event_category']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('makeup_library');
    await queryInterface.dropTable('hair_library');
    await queryInterface.removeColumn('world_events', 'event_category');
  },
};
