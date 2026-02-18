'use strict';

/**
 * Migration: Fix missing tables from asset-wardrobe-system migration
 * 
 * The 20260216000001-asset-wardrobe-system migration was marked as run in
 * SequelizeMeta by the bootstrap script, but the actual table creations
 * (episode_wardrobe_defaults, asset_usage_log) never executed on the dev RDS
 * because the DB was created by sequelize.sync().
 * 
 * This migration idempotently creates the missing tables.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Helper: check if a table exists
      const tableExists = async (tableName) => {
        const [result] = await queryInterface.sequelize.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          ) as exists`,
          { transaction }
        );
        return result[0].exists;
      };

      // ──────────────────────────────────────────────
      // 1. Create episode_wardrobe_defaults table
      // ──────────────────────────────────────────────
      if (!(await tableExists('episode_wardrobe_defaults'))) {
        console.log('  Creating episode_wardrobe_defaults table...');
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

        await queryInterface.addIndex('episode_wardrobe_defaults',
          ['episode_id', 'character_name'], {
            unique: true,
            name: 'idx_wardrobe_defaults_episode_character',
            transaction,
          });
        console.log('  ✅ episode_wardrobe_defaults created');
      } else {
        console.log('  ⏭️  episode_wardrobe_defaults already exists');
      }

      // ──────────────────────────────────────────────
      // 2. Create asset_usage_log table
      // ──────────────────────────────────────────────
      if (!(await tableExists('asset_usage_log'))) {
        console.log('  Creating asset_usage_log table...');
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
        console.log('  ✅ asset_usage_log created');
      } else {
        console.log('  ⏭️  asset_usage_log already exists');
      }

      // ──────────────────────────────────────────────
      // 3. Ensure asset columns from wardrobe migration exist
      // ──────────────────────────────────────────────
      const assetColumns = [
        { name: 'entity_type',           sql: 'VARCHAR(50)' },
        { name: 'character_name',        sql: 'VARCHAR(100)' },
        { name: 'outfit_name',           sql: 'VARCHAR(255)' },
        { name: 'outfit_era',            sql: 'VARCHAR(100)' },
        { name: 'transformation_stage',  sql: 'VARCHAR(50)' },
        { name: 'first_used_episode_id', sql: 'UUID' },
        { name: 'usage_count',           sql: 'INTEGER DEFAULT 0' },
        { name: 'color_palette',         sql: 'JSONB' },
        { name: 'mood_tags',             sql: 'TEXT[]' },
        { name: 'location_name',         sql: 'VARCHAR(255)' },
        { name: 'location_version',      sql: 'INTEGER' },
        { name: 'introduced_episode_id', sql: 'UUID' },
        { name: 'active_from_episode',   sql: 'INTEGER' },
        { name: 'active_to_episode',     sql: 'INTEGER' },
      ];

      for (const col of assetColumns) {
        await queryInterface.sequelize.query(
          `ALTER TABLE assets ADD COLUMN IF NOT EXISTS "${col.name}" ${col.sql};`,
          { transaction }
        );
      }
      console.log('  ✅ Asset wardrobe columns ensured');

      // ──────────────────────────────────────────────
      // 4. Ensure asset indexes exist
      // ──────────────────────────────────────────────
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_entity_type ON assets(entity_type);
        CREATE INDEX IF NOT EXISTS idx_assets_character ON assets(character_name) WHERE character_name IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_name, location_version) WHERE location_name IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_assets_show_category ON assets(show_id, category);
      `, { transaction });

      await transaction.commit();
      console.log('✅ Fix migration complete: wardrobe defaults + usage log tables created');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface) => {
    // These tables are also managed by 20260216000001, so just drop if present
    await queryInterface.dropTable('asset_usage_log').catch(() => {});
    await queryInterface.dropTable('episode_wardrobe_defaults').catch(() => {});
  }
};
