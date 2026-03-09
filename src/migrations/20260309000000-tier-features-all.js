'use strict';

/**
 * Migration: All Tier 1/2/3 feature tables
 *
 * New tables:
 *   - relationship_events          (Relationship timeline turning points)
 *   - story_revisions              (Revision history for edited stories)
 *   - world_timeline_events        (World calendar/timeline)
 *   - world_locations              (Location/geography database)
 *   - world_state_snapshots        (World-state per chapter)
 *   - pipeline_tracking            (End-to-end pipeline status)
 *   - story_threads                (Dead thread / subplot tracking)
 *
 * Altered tables:
 *   - storyteller_stories          (add pipeline_step, franchise_guard_result)
 *   - storyteller_chapters         (add part_number, part_title, act_number)
 */
module.exports = {
  async up(queryInterface, Sequelize) {

    // ── 1. relationship_events ────────────────────────────────────────
    await queryInterface.createTable('relationship_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      relationship_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'character_relationships', key: 'id' }, onDelete: 'CASCADE' },
      event_type: { type: Sequelize.STRING(80), allowNull: false }, // first_meeting, betrayal, reconciliation, confession, breakup, escalation, milestone
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      chapter_id: { type: Sequelize.UUID, allowNull: true },
      story_id: { type: Sequelize.UUID, allowNull: true },
      story_date: { type: Sequelize.STRING(100), allowNull: true }, // in-world date string
      tension_before: { type: Sequelize.INTEGER, allowNull: true }, // 0-10
      tension_after: { type: Sequelize.INTEGER, allowNull: true },  // 0-10
      relationship_stage: { type: Sequelize.STRING(80), allowNull: true }, // strangers, acquaintances, friends, close_friends, lovers, partners, exes, enemies
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('relationship_events', ['relationship_id'], { name: 'idx_rel_events_relationship' });

    // ── 2. story_revisions ────────────────────────────────────────────
    await queryInterface.createTable('story_revisions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      story_id: { type: Sequelize.UUID, allowNull: false },
      revision_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      text: { type: Sequelize.TEXT, allowNull: false },
      word_count: { type: Sequelize.INTEGER, allowNull: true },
      revision_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'edit' }, // original, synthesis, edit, ai_rewrite
      revision_source: { type: Sequelize.STRING(50), allowNull: true }, // user, evaluation_engine, ai_tool
      change_summary: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('story_revisions', ['story_id'], { name: 'idx_story_revisions_story' });

    // ── 3. world_timeline_events ──────────────────────────────────────
    await queryInterface.createTable('world_timeline_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      universe_id: { type: Sequelize.UUID, allowNull: true },
      book_id: { type: Sequelize.UUID, allowNull: true },
      chapter_id: { type: Sequelize.UUID, allowNull: true },
      event_name: { type: Sequelize.STRING(255), allowNull: false },
      event_description: { type: Sequelize.TEXT, allowNull: true },
      story_date: { type: Sequelize.STRING(100), allowNull: true }, // in-world date (flexible format)
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      event_type: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'plot' }, // plot, backstory, world, character, relationship
      characters_involved: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] }, // array of character_ids
      location_id: { type: Sequelize.UUID, allowNull: true },
      impact_level: { type: Sequelize.STRING(30), allowNull: true, defaultValue: 'minor' }, // minor, moderate, major, catastrophic
      consequences: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] }, // array of downstream effect descriptions
      is_canon: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('world_timeline_events', ['universe_id'], { name: 'idx_world_timeline_universe' });
    await queryInterface.addIndex('world_timeline_events', ['sort_order'], { name: 'idx_world_timeline_sort' });

    // ── 4. world_locations ────────────────────────────────────────────
    await queryInterface.createTable('world_locations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      universe_id: { type: Sequelize.UUID, allowNull: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      location_type: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'interior' }, // interior, exterior, virtual, transitional
      parent_location_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'world_locations', key: 'id' } },
      sensory_details: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} }, // { sight, sound, smell, texture, atmosphere }
      narrative_role: { type: Sequelize.STRING(100), allowNull: true }, // sanctuary, battleground, crossroads, prison, haven
      associated_characters: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      first_appearance_chapter_id: { type: Sequelize.UUID, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('world_locations', ['universe_id'], { name: 'idx_world_locations_universe' });

    // ── 5. world_state_snapshots ──────────────────────────────────────
    await queryInterface.createTable('world_state_snapshots', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      universe_id: { type: Sequelize.UUID, allowNull: true },
      book_id: { type: Sequelize.UUID, allowNull: true },
      chapter_id: { type: Sequelize.UUID, allowNull: true },
      snapshot_label: { type: Sequelize.STRING(255), allowNull: false },
      character_states: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} }, // { char_id: { alive, location, emotional_state, knowledge[], relationships_changed } }
      relationship_states: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      active_threads: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      world_facts: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] }, // known truths at this point
      timeline_position: { type: Sequelize.INTEGER, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('world_state_snapshots', ['chapter_id'], { name: 'idx_world_snapshots_chapter' });

    // ── 6. pipeline_tracking ──────────────────────────────────────────
    await queryInterface.createTable('pipeline_tracking', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      story_id: { type: Sequelize.UUID, allowNull: false },
      book_id: { type: Sequelize.UUID, allowNull: true },
      chapter_id: { type: Sequelize.UUID, allowNull: true },
      current_step: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'brief' }, // brief, generate, read, evaluate, memory, registry, write_back
      step_brief: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} }, // { completed_at, result_summary }
      step_generate: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      step_read: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      step_evaluate: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      step_memory: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      step_registry: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      step_write_back: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      started_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('pipeline_tracking', ['story_id'], { name: 'idx_pipeline_story' });
    await queryInterface.addIndex('pipeline_tracking', ['current_step'], { name: 'idx_pipeline_step' });

    // ── 7. story_threads ──────────────────────────────────────────────
    await queryInterface.createTable('story_threads', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      book_id: { type: Sequelize.UUID, allowNull: true },
      universe_id: { type: Sequelize.UUID, allowNull: true },
      thread_name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      thread_type: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'subplot' }, // main_plot, subplot, mystery, relationship_arc, character_arc, theme
      status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'active' }, // active, resolved, abandoned, dormant
      introduced_chapter_id: { type: Sequelize.UUID, allowNull: true },
      resolved_chapter_id: { type: Sequelize.UUID, allowNull: true },
      characters_involved: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      key_events: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] }, // array of { chapter_id, event_description, sort_order }
      last_referenced_chapter_id: { type: Sequelize.UUID, allowNull: true },
      chapters_since_last_reference: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      tension_level: { type: Sequelize.INTEGER, allowNull: true }, // 0-10
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('story_threads', ['book_id'], { name: 'idx_story_threads_book' });
    await queryInterface.addIndex('story_threads', ['status'], { name: 'idx_story_threads_status' });

    // ── 8. Add columns to storyteller_stories ─────────────────────────
    const storyDesc = await queryInterface.describeTable('storyteller_stories');
    if (!storyDesc.pipeline_step) {
      await queryInterface.addColumn('storyteller_stories', 'pipeline_step', {
        type: Sequelize.STRING(50), allowNull: true, defaultValue: null,
      });
    }
    if (!storyDesc.franchise_guard_result) {
      await queryInterface.addColumn('storyteller_stories', 'franchise_guard_result', {
        type: Sequelize.JSONB, allowNull: true, defaultValue: null,
      });
    }
    if (!storyDesc.continuity_check_result) {
      await queryInterface.addColumn('storyteller_stories', 'continuity_check_result', {
        type: Sequelize.JSONB, allowNull: true, defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('relationship_events').catch(() => {});
    await queryInterface.dropTable('story_revisions').catch(() => {});
    await queryInterface.dropTable('world_timeline_events').catch(() => {});
    await queryInterface.dropTable('world_locations').catch(() => {});
    await queryInterface.dropTable('world_state_snapshots').catch(() => {});
    await queryInterface.dropTable('pipeline_tracking').catch(() => {});
    await queryInterface.dropTable('story_threads').catch(() => {});
    await queryInterface.removeColumn('storyteller_stories', 'pipeline_step').catch(() => {});
    await queryInterface.removeColumn('storyteller_stories', 'franchise_guard_result').catch(() => {});
    await queryInterface.removeColumn('storyteller_stories', 'continuity_check_result').catch(() => {});
  },
};
