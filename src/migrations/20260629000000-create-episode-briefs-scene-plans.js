'use strict';

/**
 * Migration: Create episode_briefs and scene_plans tables
 *
 * episode_briefs — pre-production creative intent per episode
 * scene_plans    — AI-generated beat-by-beat scene mapping
 *                  feeds the script generator with location context
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ── episode_briefs ─────────────────────────────────────────────────────
      await queryInterface.createTable('episode_briefs', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        episode_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'episodes', key: 'id' }, onDelete: 'CASCADE' },
        show_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'shows', key: 'id' }, onDelete: 'SET NULL' },
        arc_number: { type: Sequelize.INTEGER, allowNull: true },
        position_in_arc: { type: Sequelize.INTEGER, allowNull: true },
        episode_archetype: {
          type: Sequelize.ENUM('Trial', 'Temptation', 'Breakdown', 'Redemption', 'Showcase', 'Rising', 'Pressure', 'Cliffhanger'),
          allowNull: true,
        },
        narrative_purpose: { type: Sequelize.TEXT, allowNull: true },
        designed_intent: { type: Sequelize.ENUM('slay', 'pass', 'safe', 'fail'), allowNull: true },
        allowed_outcomes: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
        forward_hook: { type: Sequelize.TEXT, allowNull: true },
        lala_state_snapshot: { type: Sequelize.JSONB, allowNull: true },
        event_id: { type: Sequelize.UUID, allowNull: true },
        event_difficulty: { type: Sequelize.JSONB, allowNull: true },
        status: { type: Sequelize.ENUM('draft', 'locked'), allowNull: false, defaultValue: 'draft' },
        ai_generated_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });

      // ── scene_plans ────────────────────────────────────────────────────────
      await queryInterface.createTable('scene_plans', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        episode_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'episodes', key: 'id' }, onDelete: 'CASCADE' },
        episode_brief_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'episode_briefs', key: 'id' }, onDelete: 'SET NULL' },
        beat_number: { type: Sequelize.INTEGER, allowNull: false },
        beat_name: { type: Sequelize.STRING, allowNull: true },
        scene_set_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'scene_sets', key: 'id' }, onDelete: 'SET NULL' },
        angle_label: { type: Sequelize.STRING(50), allowNull: true },
        shot_type: { type: Sequelize.ENUM('establishing', 'medium', 'close', 'tracking', 'cutaway', 'transition'), allowNull: true },
        emotional_intent: { type: Sequelize.TEXT, allowNull: true },
        transition_in: { type: Sequelize.ENUM('cut', 'glow', 'push', 'wipe', 'dissolve', 'none'), allowNull: true, defaultValue: 'cut' },
        scene_context: { type: Sequelize.TEXT, allowNull: true },
        director_note: { type: Sequelize.TEXT, allowNull: true },
        locked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        ai_suggested: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        ai_confidence: { type: Sequelize.FLOAT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });

      // ── Indexes ─────────────────────────────────────────────────────────────
      await queryInterface.addIndex('episode_briefs', ['episode_id'], { name: 'idx_episode_briefs_episode_id', transaction });
      await queryInterface.addIndex('episode_briefs', ['show_id'], { name: 'idx_episode_briefs_show_id', transaction });
      await queryInterface.addIndex('episode_briefs', ['status'], { name: 'idx_episode_briefs_status', transaction });
      await queryInterface.addIndex('scene_plans', ['episode_id'], { name: 'idx_scene_plans_episode_id', transaction });
      await queryInterface.addIndex('scene_plans', ['episode_id', 'beat_number'], { name: 'idx_scene_plans_episode_beat', unique: true, transaction });
      await queryInterface.addIndex('scene_plans', ['scene_set_id'], { name: 'idx_scene_plans_scene_set_id', transaction });

      await transaction.commit();
      console.log('✓ episode_briefs and scene_plans tables created');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('scene_plans', { transaction });
      await queryInterface.dropTable('episode_briefs', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
