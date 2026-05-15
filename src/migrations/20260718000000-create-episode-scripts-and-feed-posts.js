'use strict';

/**
 * Migration: Episode Scripts + Feed Posts
 *
 * episode_scripts — full AI-generated scripts per episode with versioning
 * feed_posts — timeline posts generated after episodes (character reactions, BTS, etc.)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Episode Scripts ──────────────────────────────────────────────────
    await queryInterface.createTable('episode_scripts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      episode_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'episodes', key: 'id' } },
      show_id: { type: Sequelize.UUID, allowNull: true },
      episode_brief_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'episode_briefs', key: 'id' } },

      // ── Version tracking
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'draft' },
      // draft → review → approved → locked → archived

      // ── Script content
      title: { type: Sequelize.STRING(255), allowNull: true },
      script_text: { type: Sequelize.TEXT, allowNull: true },
      // Full rendered script (Me: / Lala: / (Action) / [STAT:] format)

      script_json: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
      // Structured: [{ beat_number, beat_name, lines: [{ speaker, type, text, direction }] }]

      // ── Generation metadata
      generation_model: { type: Sequelize.STRING(60), allowNull: true },
      generation_tokens: { type: Sequelize.INTEGER, allowNull: true },
      generation_cost: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
      generation_prompt_hash: { type: Sequelize.STRING(64), allowNull: true },

      // ── Context snapshot (what data fed the generation)
      context_snapshot: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
      // { brief, event, wardrobe, financial_state, feed_moments, franchise_laws }

      // ── Feed moments integration
      feed_moments_used: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      // [{ beat_number, trigger_profile, trigger_action, phone_screen_type }]

      // ── Financial pressure integration
      financial_context: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
      // { total_income, total_expenses, balance, financial_score, pressure_level, budget_for_event }

      // ── Wardrobe integration
      wardrobe_locked: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      // [{ wardrobe_id, name, category, tier, affordability_note }]

      // ── Scene studio integration
      scene_angles_used: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      // [{ beat_number, scene_set_id, angle_label, still_image_url }]

      // ── Quality metrics
      word_count: { type: Sequelize.INTEGER, allowNull: true },
      beat_count: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 14 },
      voice_score: { type: Sequelize.INTEGER, allowNull: true },
      // 0-100 how well it matches JAWIHP + Lala voice DNA

      // ── Author edits
      author_notes: { type: Sequelize.TEXT, allowNull: true },
      edited_by: { type: Sequelize.STRING(100), allowNull: true },
      edited_at: { type: Sequelize.DATE, allowNull: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // Self-heal for partially-created tables from failed prior attempts.
    // If `version` is missing, unique (episode_id, version) index creation fails.
    const scriptColumns = await queryInterface.describeTable('episode_scripts');
    if (!scriptColumns.version) {
      await queryInterface.addColumn('episode_scripts', 'version', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_scripts_episode_version
      ON episode_scripts (episode_id, version)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_status
      ON episode_scripts (status)
    `);

    // ── Feed Posts ────────────────────────────────────────────────────────
    await queryInterface.createTable('feed_posts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      show_id: { type: Sequelize.UUID, allowNull: false },

      // ── Source link
      episode_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'episodes', key: 'id' } },
      event_id: { type: Sequelize.UUID, allowNull: true },
      opportunity_id: { type: Sequelize.UUID, allowNull: true },

      // ── Who posts
      social_profile_id: { type: Sequelize.INTEGER, allowNull: true },
      poster_handle: { type: Sequelize.STRING(100), allowNull: false },
      poster_display_name: { type: Sequelize.STRING(200), allowNull: true },
      poster_platform: { type: Sequelize.STRING(30), allowNull: true, defaultValue: 'instagram' },

      // ── Post content
      post_type: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'post' },
      // post | story | reel | tweet | tiktok | live | dm_screenshot | notification

      content_text: { type: Sequelize.TEXT, allowNull: true },
      image_description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.TEXT, allowNull: true },

      // ── Engagement
      likes: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      comments_count: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      shares: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      sample_comments: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      // [{ handle, text, likes, is_lala }]

      // ── Timeline placement
      posted_at: { type: Sequelize.DATE, allowNull: true },
      timeline_position: { type: Sequelize.STRING(30), allowNull: true },
      // before_episode | during_episode | after_episode | next_day | week_later

      // ── Narrative function
      narrative_function: { type: Sequelize.STRING(50), allowNull: true },
      // reaction | bts | flex | shade | support | comparison | gossip | brand_content | callback

      lala_reaction: { type: Sequelize.TEXT, allowNull: true },
      lala_internal_thought: { type: Sequelize.TEXT, allowNull: true },
      emotional_impact: { type: Sequelize.STRING(50), allowNull: true },
      // confidence_boost | anxiety | jealousy | validation | indifference | anger

      // ── Generation
      ai_generated: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      generation_model: { type: Sequelize.STRING(60), allowNull: true },

      // ── Ordering
      sort_order: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feed_posts_episode
      ON feed_posts (episode_id)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feed_posts_profile
      ON feed_posts (social_profile_id)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feed_posts_timeline
      ON feed_posts (show_id, posted_at)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feed_posts_function
      ON feed_posts (narrative_function)
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('feed_posts');
    await queryInterface.dropTable('episode_scripts');
  },
};
