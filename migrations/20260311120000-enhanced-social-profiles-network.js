'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── New columns on social_profiles ─────────────────────────────────────
    const addCol = (col, type, opts = {}) =>
      queryInterface.addColumn('social_profiles', col, { type, allowNull: true, ...opts })
        .catch(() => {});

    await addCol('post_frequency',         Sequelize.STRING(100));
    await addCol('engagement_rate',        Sequelize.STRING(50));
    await addCol('platform_metrics',       Sequelize.JSONB, { defaultValue: {} });
    await addCol('geographic_base',        Sequelize.STRING(200));
    await addCol('geographic_cluster',     Sequelize.STRING(100));
    await addCol('age_range',              Sequelize.STRING(30));
    await addCol('relationship_status',    Sequelize.STRING(100));
    await addCol('known_associates',       Sequelize.JSONB, { defaultValue: [] });
    await addCol('revenue_streams',        Sequelize.JSONB, { defaultValue: [] });
    await addCol('brand_partnerships',     Sequelize.JSONB, { defaultValue: [] });
    await addCol('audience_demographics',  Sequelize.JSONB, { defaultValue: {} });
    await addCol('aesthetic_dna',          Sequelize.JSONB, { defaultValue: {} });
    await addCol('controversy_history',    Sequelize.JSONB, { defaultValue: [] });
    await addCol('collab_style',           Sequelize.TEXT);
    await addCol('influencer_tier_detail', Sequelize.TEXT);

    // ── social_profile_relationships table ─────────────────────────────────
    await queryInterface.createTable('social_profile_relationships', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      source_profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      target_profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      relationship_type: {
        type: Sequelize.ENUM(
          'collab', 'rival', 'couple', 'ex', 'baby_daddy', 'baby_mama',
          'bestie', 'mentor', 'copycat', 'shade', 'situationship',
          'family', 'management', 'feud', 'secret_link'
        ),
        allowNull: false,
      },
      direction: {
        type: Sequelize.ENUM('mutual', 'source_to_target', 'target_to_source'),
        defaultValue: 'mutual',
      },
      drama_level: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      public_visibility: {
        type: Sequelize.ENUM('public', 'rumored', 'hidden'),
        defaultValue: 'public',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      timeline_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      narrative_function: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      auto_generated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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
    }).catch(() => {});

    // Indexes for relationship queries
    await queryInterface.addIndex('social_profile_relationships', ['source_profile_id']).catch(() => {});
    await queryInterface.addIndex('social_profile_relationships', ['target_profile_id']).catch(() => {});
    await queryInterface.addIndex('social_profile_relationships', ['relationship_type']).catch(() => {});
    await queryInterface.addIndex('social_profile_relationships', ['source_profile_id', 'target_profile_id', 'relationship_type'], {
      unique: true,
      name: 'spr_unique_pair_type',
    }).catch(() => {});

    // Index for geographic clustering
    await queryInterface.addIndex('social_profiles', ['geographic_cluster'], { name: 'sp_geo_cluster' }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.dropTable('social_profile_relationships').catch(() => {});

    const cols = [
      'post_frequency', 'engagement_rate', 'platform_metrics',
      'geographic_base', 'geographic_cluster', 'age_range',
      'relationship_status', 'known_associates', 'revenue_streams',
      'brand_partnerships', 'audience_demographics', 'aesthetic_dna',
      'controversy_history', 'collab_style', 'influencer_tier_detail',
    ];
    for (const col of cols) {
      await queryInterface.removeColumn('social_profiles', col).catch(() => {});
    }
  },
};
