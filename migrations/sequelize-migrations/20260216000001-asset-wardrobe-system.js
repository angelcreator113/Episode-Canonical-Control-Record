'use strict';

/**
 * Migration: Asset System Restructure - Wardrobe & Category System
 * 
 * Adds entity_type, asset_category, transformation_stage enums.
 * Extends assets table with wardrobe/background metadata columns.
 * Adds scene_assets columns for character placement.
 * Creates episode_wardrobe_defaults and asset_usage_log tables.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ──────────────────────────────────────────────
      // 1. Create ENUM types (safe: skip if exists)
      // ──────────────────────────────────────────────
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE entity_type AS ENUM ('character', 'creator', 'prop', 'environment');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE asset_category AS ENUM (
            'wardrobe_outfit',
            'wardrobe_accessory',
            'wardrobe_shoes',
            'wardrobe_hairstyle',
            'wardrobe_pose',
            'background',
            'ui_element',
            'prop',
            'overlay',
            'music',
            'sfx'
          );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE transformation_stage AS ENUM ('before', 'during', 'after', 'neutral');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `, { transaction });

      // ──────────────────────────────────────────────
      // 2. Extend assets table with wardrobe columns
      // ──────────────────────────────────────────────
      const assetColumns = [
        { name: 'entity_type',           sql: 'entity_type' },
        { name: 'category',              sql: 'asset_category' },
        { name: 'character_name',        sql: 'VARCHAR(100)' },
        { name: 'outfit_name',           sql: 'VARCHAR(255)' },
        { name: 'outfit_era',            sql: 'VARCHAR(100)' },
        { name: 'transformation_stage',  sql: 'transformation_stage' },
        { name: 'first_used_episode_id', sql: 'UUID REFERENCES episodes(id)' },
        { name: 'usage_count',           sql: 'INTEGER DEFAULT 0' },
        { name: 'color_palette',         sql: 'JSONB' },
        { name: 'mood_tags',             sql: 'TEXT[]' },
        { name: 'location_name',         sql: 'VARCHAR(255)' },
        { name: 'location_version',      sql: 'INTEGER' },
        { name: 'introduced_episode_id', sql: 'UUID REFERENCES episodes(id)' },
        { name: 'active_from_episode',   sql: 'INTEGER' },
        { name: 'active_to_episode',     sql: 'INTEGER' },
      ];

      for (const col of assetColumns) {
        await queryInterface.sequelize.query(
          `ALTER TABLE assets ADD COLUMN IF NOT EXISTS "${col.name}" ${col.sql};`,
          { transaction }
        );
      }

      // ──────────────────────────────────────────────
      // 3. Add new columns to scene_assets table
      // ──────────────────────────────────────────────
      const sceneAssetColumns = [
        { name: 'asset_role',      sql: "VARCHAR(50)" },
        { name: 'character_name',  sql: "VARCHAR(100)" },
        { name: 'position_x',     sql: "INTEGER" },
        { name: 'position_y',     sql: "INTEGER" },
        { name: 'scale',          sql: "DECIMAL(5,2) DEFAULT 1.0" },
        { name: 'z_index',        sql: "INTEGER DEFAULT 0" },
      ];

      for (const col of sceneAssetColumns) {
        await queryInterface.sequelize.query(
          `ALTER TABLE scene_assets ADD COLUMN IF NOT EXISTS "${col.name}" ${col.sql};`,
          { transaction }
        );
      }

      // ──────────────────────────────────────────────
      // 4. Create indexes for efficient querying
      // ──────────────────────────────────────────────
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_entity_type ON assets(entity_type);
        CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
        CREATE INDEX IF NOT EXISTS idx_assets_character ON assets(character_name) WHERE character_name IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_name, location_version) WHERE location_name IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_assets_show_category ON assets(show_id, category);
      `, { transaction });

      // ──────────────────────────────────────────────
      // 5. Create episode_wardrobe_defaults table
      // ──────────────────────────────────────────────
      await queryInterface.createTable('episode_wardrobe_defaults', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'episodes', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        character_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        default_outfit_asset_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'assets', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
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

      // Unique constraint on (episode_id, character_name)
      await queryInterface.addIndex('episode_wardrobe_defaults', ['episode_id', 'character_name'], {
        unique: true,
        name: 'idx_wardrobe_defaults_episode_character',
        transaction,
      });

      // ──────────────────────────────────────────────
      // 6. Create asset_usage_log table
      // ──────────────────────────────────────────────
      await queryInterface.createTable('asset_usage_log', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        asset_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'assets', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'episodes', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        scene_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'scenes', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        context: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Usage context: scene_background, scene_character, timeline_overlay, etc.',
        },
        used_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('asset_usage_log', ['asset_id'], {
        name: 'idx_asset_usage_asset',
        transaction,
      });
      await queryInterface.addIndex('asset_usage_log', ['episode_id'], {
        name: 'idx_asset_usage_episode',
        transaction,
      });
      await queryInterface.addIndex('asset_usage_log', ['scene_id'], {
        name: 'idx_asset_usage_scene',
        transaction,
      });

      await transaction.commit();
      console.log('✅ Migration complete: Asset wardrobe system tables created');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop new tables
      await queryInterface.dropTable('asset_usage_log', { transaction });
      await queryInterface.dropTable('episode_wardrobe_defaults', { transaction });

      // Remove new scene_assets columns
      const sceneAssetCols = ['asset_role', 'character_name', 'position_x', 'position_y', 'scale', 'z_index'];
      for (const col of sceneAssetCols) {
        await queryInterface.removeColumn('scene_assets', col, { transaction }).catch(() => {});
      }

      // Remove new assets columns
      const assetCols = [
        'entity_type', 'category', 'character_name', 'outfit_name', 'outfit_era',
        'transformation_stage', 'first_used_episode_id', 'usage_count', 'color_palette',
        'mood_tags', 'location_name', 'location_version', 'introduced_episode_id',
        'active_from_episode', 'active_to_episode'
      ];
      for (const col of assetCols) {
        await queryInterface.removeColumn('assets', col, { transaction }).catch(() => {});
      }

      // Remove indexes
      await queryInterface.removeIndex('assets', 'idx_assets_entity_type', { transaction }).catch(() => {});
      await queryInterface.removeIndex('assets', 'idx_assets_category', { transaction }).catch(() => {});
      await queryInterface.removeIndex('assets', 'idx_assets_character', { transaction }).catch(() => {});
      await queryInterface.removeIndex('assets', 'idx_assets_location', { transaction }).catch(() => {});
      await queryInterface.removeIndex('assets', 'idx_assets_show_category', { transaction }).catch(() => {});

      // Drop enums
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS entity_type;', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS asset_category;', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS transformation_stage;', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
