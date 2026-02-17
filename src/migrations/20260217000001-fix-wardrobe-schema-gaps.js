'use strict';

/**
 * Migration: Fix schema gaps for wardrobe system
 * 
 * 1. Add category column to assets (was in model but missing from migration)
 * 2. Fix assets.show_id type if it's INTEGER (should be UUID)
 * 3. Create episode_assets table if missing, or add deleted_at column
 * 4. Create wardrobe table if missing, or add show_id column
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Helper: check if a table exists
      const tableExists = async (tableName) => {
        const [results] = await queryInterface.sequelize.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '${tableName}'
          )`,
          { transaction }
        );
        return results[0].exists;
      };

      // 1. Add category column to assets if not exists
      await queryInterface.sequelize.query(
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS "category" VARCHAR(50);`,
        { transaction }
      );

      // 2. Fix assets.show_id type if it's INTEGER instead of UUID
      const [showIdType] = await queryInterface.sequelize.query(
        `SELECT data_type FROM information_schema.columns 
         WHERE table_name = 'assets' AND column_name = 'show_id'`,
        { transaction }
      );
      if (showIdType.length > 0 && showIdType[0].data_type === 'integer') {
        // Drop FKs on show_id
        const [fks] = await queryInterface.sequelize.query(`
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'assets' AND kcu.column_name = 'show_id' AND tc.constraint_type = 'FOREIGN KEY'
        `, { transaction });
        for (const fk of fks) {
          await queryInterface.sequelize.query(
            `ALTER TABLE assets DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`,
            { transaction }
          );
        }
        // Drop indexes referencing show_id
        const [idxs] = await queryInterface.sequelize.query(`
          SELECT indexname FROM pg_indexes WHERE tablename = 'assets' AND indexdef LIKE '%show_id%'
        `, { transaction });
        for (const idx of idxs) {
          await queryInterface.sequelize.query(
            `DROP INDEX IF EXISTS "${idx.indexname}"`,
            { transaction }
          );
        }
        // Clear values and alter type
        await queryInterface.sequelize.query(
          `UPDATE assets SET show_id = NULL WHERE show_id IS NOT NULL`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE assets ALTER COLUMN show_id TYPE UUID USING show_id::text::uuid`,
          { transaction }
        );
      }

      // Recreate index
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_assets_show_category ON assets(show_id, category)`,
        { transaction }
      );

      // 3. episode_assets — create if missing, otherwise just add deleted_at
      if (await tableExists('episode_assets')) {
        await queryInterface.sequelize.query(
          `ALTER TABLE episode_assets ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;`,
          { transaction }
        );
      } else {
        await queryInterface.sequelize.query(`
          CREATE TABLE episode_assets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            episode_id UUID NOT NULL,
            asset_id UUID NOT NULL,
            folder VARCHAR(100),
            sort_order INTEGER DEFAULT 0,
            tags TEXT[],
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            added_by VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
          );
        `, { transaction });
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_episode_assets_episode_id ON episode_assets(episode_id);`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_episode_assets_asset_id ON episode_assets(asset_id);`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_episode_assets_episode_folder ON episode_assets(episode_id, folder);`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_assets_episode_asset ON episode_assets(episode_id, asset_id);`,
          { transaction }
        );
      }

      // 4. wardrobe — create if missing, otherwise just add show_id
      if (await tableExists('wardrobe')) {
        await queryInterface.sequelize.query(
          `ALTER TABLE wardrobe ADD COLUMN IF NOT EXISTS "show_id" UUID;`,
          { transaction }
        );
      } else {
        await queryInterface.sequelize.query(`
          CREATE TABLE wardrobe (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            "character" VARCHAR(255),
            character_id UUID,
            clothing_category VARCHAR(50) NOT NULL,
            description TEXT,
            s3_key VARCHAR(500),
            s3_url TEXT,
            s3_key_processed VARCHAR(500),
            s3_url_processed TEXT,
            thumbnail_url TEXT,
            brand VARCHAR(255),
            price DECIMAL(10,2),
            purchase_link TEXT,
            website VARCHAR(255),
            color VARCHAR(100),
            size VARCHAR(50),
            season VARCHAR(50),
            occasion VARCHAR(100),
            outfit_set_id VARCHAR(255),
            outfit_set_name VARCHAR(255),
            scene_description TEXT,
            outfit_notes TEXT,
            times_worn INTEGER DEFAULT 0,
            last_worn_date DATE,
            tags JSONB DEFAULT '[]',
            notes TEXT,
            is_favorite BOOLEAN DEFAULT false,
            library_item_id INTEGER,
            show_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
          );
        `, { transaction });
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_wardrobe_character_id ON wardrobe(character_id);`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_wardrobe_clothing_category ON wardrobe(clothing_category);`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_wardrobe_is_favorite ON wardrobe(is_favorite);`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_wardrobe_deleted_at ON wardrobe(deleted_at);`,
          { transaction }
        );
      }
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_wardrobe_show_id ON wardrobe(show_id)`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_wardrobe_show_id`, { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP TABLE IF EXISTS wardrobe`, { transaction }
      );
      await queryInterface.sequelize.query(
        `DROP TABLE IF EXISTS episode_assets`, { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE assets DROP COLUMN IF EXISTS category`, { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
