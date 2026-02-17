'use strict';

/**
 * Migration: Fix schema gaps for wardrobe system
 * 
 * 1. Add category column to assets (was in model but missing from migration)
 * 2. Fix assets.show_id type if it's INTEGER (should be UUID)
 * 3. Add deleted_at to episode_assets (Sequelize paranoid propagation)
 * 4. Add show_id to wardrobe table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
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

      // 3. Add deleted_at to episode_assets
      await queryInterface.sequelize.query(
        `ALTER TABLE episode_assets ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;`,
        { transaction }
      );

      // 4. Add show_id to wardrobe table
      await queryInterface.sequelize.query(
        `ALTER TABLE wardrobe ADD COLUMN IF NOT EXISTS "show_id" UUID;`,
        { transaction }
      );
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
        `ALTER TABLE wardrobe DROP COLUMN IF EXISTS show_id`, { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE episode_assets DROP COLUMN IF EXISTS deleted_at`, { transaction }
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
