'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // ── 1. franchise_tech_knowledge ───────────────────────────────────────
    // Completely separate from franchise_story_knowledge (franchise_knowledge table)
    // Story engine never reads this. Build assistant reads this. Never cross.
    await queryInterface.createTable('franchise_tech_knowledge', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING(200), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      category: {
        type: Sequelize.ENUM(
          'deployed_system',    // What is live and working
          'route_registry',     // API routes that exist
          'schema',             // Database tables and columns
          'architecture_rule',  // Locked technical decisions
          'build_pattern',      // How things are built in this stack
          'pending_build',      // What is next / not built yet
          'integration'         // How systems connect to each other
        ),
        defaultValue: 'deployed_system',
      },
      severity: {
        type: Sequelize.ENUM('critical', 'important', 'context'),
        defaultValue: 'important',
      },
      applies_to: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Tags: system names, route prefixes, table names',
      },
      source_document: { type: Sequelize.STRING(100), allowNull: true },
      source_version: { type: Sequelize.STRING(20), allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'pending_review', 'superseded', 'archived'),
        defaultValue: 'active',
      },
      extracted_by: {
        type: Sequelize.ENUM('document_ingestion', 'conversation_extraction', 'direct_entry', 'system'),
        defaultValue: 'direct_entry',
      },
      injection_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      last_injected_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('franchise_tech_knowledge', ['category']);
    await queryInterface.addIndex('franchise_tech_knowledge', ['status']);

    // ── 2. session_briefs ─────────────────────────────────────────────────
    // Auto-generated at the start of each build session
    // Reads tech knowledge + recent deviations + arc state → hands me context
    await queryInterface.createTable('session_briefs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      brief_text: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'The full session brief — what the assistant knows walking in',
      },
      tech_snapshot: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'State of deployed systems at time of brief generation',
      },
      story_snapshot: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Arc stage, scene counts, recent character changes',
      },
      pending_builds: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'What is next in the build queue',
      },
      generated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      used_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── 3. post_generation_reviews ────────────────────────────────────────
    // Runs after every approved scene — reads output against franchise laws
    // Catches what the guard misses
    await queryInterface.createTable('post_generation_reviews', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      story_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'The storyteller_story that was reviewed',
      },
      approved_version_reviewed: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'The exact text that was reviewed',
      },
      violations: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Franchise law violations found in the output',
      },
      warnings: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Non-critical flags worth author attention',
      },
      passed: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'True if no critical violations found',
      },
      knowledge_entries_checked: { type: Sequelize.INTEGER, defaultValue: 0 },
      review_note: { type: Sequelize.TEXT, allowNull: true },
      author_acknowledged: { type: Sequelize.BOOLEAN, defaultValue: false },
      acknowledged_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('post_generation_reviews', ['story_id']);
    await queryInterface.addIndex('post_generation_reviews', ['passed']);
    await queryInterface.addIndex('post_generation_reviews', ['author_acknowledged']);

    // ── 4. writing_rhythm ─────────────────────────────────────────────────
    // One row per writing session — tracks consistency
    await queryInterface.createTable('writing_rhythm', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      session_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'The date of the writing session',
      },
      scenes_proposed: { type: Sequelize.INTEGER, defaultValue: 0 },
      scenes_generated: { type: Sequelize.INTEGER, defaultValue: 0 },
      scenes_approved: { type: Sequelize.INTEGER, defaultValue: 0 },
      words_written: { type: Sequelize.INTEGER, defaultValue: 0 },
      arc_stage: { type: Sequelize.STRING(30), allowNull: true },
      session_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('writing_rhythm', ['session_date']);

    // ── 5. writing_goals ──────────────────────────────────────────────────
    // Author-set targets — rhythm tracker measures against these
    await queryInterface.createTable('writing_goals', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      goal_type: {
        type: Sequelize.ENUM('daily', 'weekly', 'arc_stage', 'book'),
        defaultValue: 'weekly',
      },
      target_scenes: { type: Sequelize.INTEGER, allowNull: true },
      target_words: { type: Sequelize.INTEGER, allowNull: true },
      target_sessions: { type: Sequelize.INTEGER, allowNull: true },
      cadence: {
        type: Sequelize.ENUM('daily', 'weekdays', '3_per_week', 'burst'),
        defaultValue: 'weekdays',
      },
      active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── 6. multi_product_content ──────────────────────────────────────────
    // Generated from every approved scene — surfaces content for all three products
    await queryInterface.createTable('multi_product_content', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      story_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'The approved scene this was generated from',
      },
      format: {
        type: Sequelize.ENUM(
          'instagram_caption',
          'tiktok_concept',
          'howto_lesson',
          'bestie_newsletter',
          'behind_the_scenes'
        ),
        allowNull: false,
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      headline: { type: Sequelize.STRING(200), allowNull: true },
      emotional_core: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'The scene emotion this content is drawing from',
      },
      book2_seed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'True if this howto_lesson is a Book 2 coaching realization seed',
      },
      status: {
        type: Sequelize.ENUM('draft', 'approved', 'posted', 'archived'),
        defaultValue: 'draft',
      },
      posted_at: { type: Sequelize.DATE, allowNull: true },
      author_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('multi_product_content', ['story_id']);
    await queryInterface.addIndex('multi_product_content', ['format']);
    await queryInterface.addIndex('multi_product_content', ['status']);

    // ── Seed initial writing goal ─────────────────────────────────────────
    await queryInterface.bulkInsert('writing_goals', [{
      goal_type: 'weekly',
      target_scenes: 3,
      target_words: 3000,
      target_sessions: 3,
      cadence: 'weekdays',
      active: true,
      created_at: now,
      updated_at: now,
    }]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('multi_product_content');
    await queryInterface.dropTable('writing_goals');
    await queryInterface.dropTable('writing_rhythm');
    await queryInterface.dropTable('post_generation_reviews');
    await queryInterface.dropTable('session_briefs');
    await queryInterface.dropTable('franchise_tech_knowledge');

    for (const type of [
      'enum_franchise_tech_knowledge_category',
      'enum_franchise_tech_knowledge_severity',
      'enum_franchise_tech_knowledge_status',
      'enum_franchise_tech_knowledge_extracted_by',
      'enum_post_generation_reviews_passed',
      'enum_writing_rhythm_arc_stage',
      'enum_writing_goals_goal_type',
      'enum_writing_goals_cadence',
      'enum_multi_product_content_format',
      'enum_multi_product_content_status',
    ]) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${type}";`).catch(() => {});
    }
  },
};
