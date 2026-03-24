'use strict';

/**
 * Migration: Add generation_status column to scene_sets
 *
 * The SceneSet model defines generation_status as an ENUM but the column
 * was never added via migration — only present when ENABLE_DB_SYNC + alter
 * was used.  This migration adds it explicitly so it is available on all
 * environments.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('scene_sets').catch(() => null);
    if (!table) return; // scene_sets table doesn't exist yet

    if (table.generation_status) {
      console.log('scene_sets.generation_status already exists — skipping');
      return;
    }

    // Create the ENUM type first (idempotent)
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_scene_sets_generation_status"
          AS ENUM ('pending', 'generating', 'complete', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryInterface.addColumn('scene_sets', 'generation_status', {
      type: Sequelize.ENUM('pending', 'generating', 'complete', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('scene_sets', 'generation_status').catch(() => {});
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_scene_sets_generation_status";'
    ).catch(() => {});
  },
};
