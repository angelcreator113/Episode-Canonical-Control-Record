'use strict';

/**
 * Migration: Fix scenes.thumbnail_id type from UUID to INTEGER
 * 
 * This fixes the type mismatch where scenes.thumbnail_id is UUID 
 * but should be INTEGER to match thumbnails.id
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the foreign key constraint if it exists
    await queryInterface.sequelize.query(`
      ALTER TABLE scenes
      DROP CONSTRAINT IF EXISTS scenes_thumbnail_id_fkey;
    `);

    // Drop the index if it exists
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_scenes_thumbnail_id;
    `);

    // Change the column type from UUID to INTEGER
    // Any existing UUID values will be set to NULL since they can't be converted
    await queryInterface.sequelize.query(`
      ALTER TABLE scenes
      ALTER COLUMN thumbnail_id DROP DEFAULT;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE scenes
      ALTER COLUMN thumbnail_id TYPE INTEGER 
      USING NULL;
    `);

    // Re-add the foreign key constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE scenes
      ADD CONSTRAINT scenes_thumbnail_id_fkey
      FOREIGN KEY (thumbnail_id)
      REFERENCES thumbnails(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
    `);

    // Re-add the index
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_scenes_thumbnail_id ON scenes(thumbnail_id);
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop constraints and index
    await queryInterface.sequelize.query(`
      ALTER TABLE scenes
      DROP CONSTRAINT IF EXISTS scenes_thumbnail_id_fkey;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_scenes_thumbnail_id;
    `);

    // Change back to UUID (will lose data)
    await queryInterface.sequelize.query(`
      ALTER TABLE scenes
      ALTER COLUMN thumbnail_id TYPE UUID 
      USING NULL;
    `);

    // Re-add constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE scenes
      ADD CONSTRAINT scenes_thumbnail_id_fkey
      FOREIGN KEY (thumbnail_id)
      REFERENCES thumbnails(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
    `);

    // Re-add index
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_scenes_thumbnail_id ON scenes(thumbnail_id);
    `);
  },
};
