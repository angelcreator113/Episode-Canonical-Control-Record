'use strict';

/**
 * Migration: Create missing tables — batch 3
 *
 * Tables: outfit_sets, writing_rhythm, amber_task_queue,
 *         wardrobe_usage_history, multi_product_content, outfit_set_items
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ── outfit_sets ──────────────────────────────────────────────────
      await queryInterface.createTable('outfit_sets', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        character: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        occasion: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        season: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        items: {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: [],
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
      }, { transaction });

      // ── writing_rhythm ───────────────────────────────────────────────
      await queryInterface.createTable('writing_rhythm', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        session_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        scenes_proposed: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        scenes_generated: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        scenes_approved: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        words_written: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        arc_stage: {
          type: Sequelize.STRING(30),
          allowNull: true,
        },
        session_note: {
          type: Sequelize.TEXT,
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
      }, { transaction });

      // ── amber_task_queue ─────────────────────────────────────────────
      await queryInterface.createTable('amber_task_queue', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        type: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'feature',
        },
        priority: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'medium',
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'backlog',
        },
        source: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        linked_finding_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        spec: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        spec_approved: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        amber_notes: {
          type: Sequelize.TEXT,
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
      }, { transaction });

      // ── wardrobe_usage_history ───────────────────────────────────────
      await queryInterface.createTable('wardrobe_usage_history', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        library_item_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'wardrobe_library', key: 'id' },
          onDelete: 'CASCADE',
        },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'episodes', key: 'id' },
          onDelete: 'CASCADE',
        },
        scene_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'scenes', key: 'id' },
          onDelete: 'CASCADE',
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'shows', key: 'id' },
          onDelete: 'SET NULL',
        },
        usage_type: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        character: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        occasion: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        user_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {},
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('wardrobe_usage_history', ['library_item_id'],
        { name: 'idx_wardrobe_usage_library_item', transaction });
      await queryInterface.addIndex('wardrobe_usage_history', ['episode_id'],
        { name: 'idx_wardrobe_usage_episode', transaction });

      // ── multi_product_content ────────────────────────────────────────
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_multi_product_content_format" AS ENUM ('instagram_caption', 'tiktok_concept', 'howto_lesson', 'bestie_newsletter', 'behind_the_scenes');`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_multi_product_content_status" AS ENUM ('draft', 'approved', 'posted', 'archived');`,
        { transaction }
      );

      await queryInterface.createTable('multi_product_content', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        story_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        format: {
          type: Sequelize.ENUM('instagram_caption', 'tiktok_concept', 'howto_lesson', 'bestie_newsletter', 'behind_the_scenes'),
          allowNull: false,
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        headline: {
          type: Sequelize.STRING(200),
          allowNull: true,
        },
        emotional_core: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        book2_seed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        status: {
          type: Sequelize.ENUM('draft', 'approved', 'posted', 'archived'),
          allowNull: false,
          defaultValue: 'draft',
        },
        posted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        author_note: {
          type: Sequelize.TEXT,
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
      }, { transaction });

      // ── outfit_set_items ─────────────────────────────────────────────
      await queryInterface.createTable('outfit_set_items', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        outfit_set_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'wardrobe_library', key: 'id' },
          onDelete: 'CASCADE',
        },
        wardrobe_item_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'wardrobe_library', key: 'id' },
          onDelete: 'CASCADE',
        },
        position: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        layer: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        is_optional: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('outfit_set_items', ['outfit_set_id'],
        { name: 'idx_outfit_set_items_set', transaction });
      await queryInterface.addIndex('outfit_set_items', ['wardrobe_item_id'],
        { name: 'idx_outfit_set_items_item', transaction });

      await transaction.commit();
      console.log('✓ Created: outfit_sets, writing_rhythm, amber_task_queue, wardrobe_usage_history, multi_product_content, outfit_set_items');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('outfit_set_items', { transaction });
      await queryInterface.dropTable('multi_product_content', { transaction });
      await queryInterface.dropTable('wardrobe_usage_history', { transaction });
      await queryInterface.dropTable('amber_task_queue', { transaction });
      await queryInterface.dropTable('writing_rhythm', { transaction });
      await queryInterface.dropTable('outfit_sets', { transaction });

      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_multi_product_content_format";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_multi_product_content_status";',
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
