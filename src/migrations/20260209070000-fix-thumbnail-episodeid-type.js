'use strict';

/**
 * Migration: Fix Thumbnail episodeId type from INTEGER to UUID
 * 
 * This migration fixes a type mismatch where Thumbnail.episodeId was INTEGER
 * but Episode.id is UUID, causing "operator does not exist: uuid = integer" errors.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, drop the foreign key constraint if it exists
    await queryInterface.sequelize.query(`
      ALTER TABLE thumbnails
      DROP CONSTRAINT IF EXISTS thumbnails_episodeId_fkey;
    `);

    // Drop the index if it exists
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_episode_id;
    `);

    // Change the column type from INTEGER to UUID
    // Note: This assumes episodeId values can be converted or table is empty
    // If you have existing data, you may need to handle migration differently
    await queryInterface.sequelize.query(`
      ALTER TABLE thumbnails
      ALTER COLUMN "episodeId" TYPE UUID USING "episodeId"::uuid;
    `);

    // Re-add the foreign key constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE thumbnails
      ADD CONSTRAINT thumbnails_episodeId_fkey
      FOREIGN KEY ("episodeId")
      REFERENCES episodes(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `);

    // Re-add the index
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_id ON thumbnails("episodeId");
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the foreign key constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE thumbnails
      DROP CONSTRAINT IF EXISTS thumbnails_episodeId_fkey;
    `);

    // Drop the index
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_episode_id;
    `);

    // Change back to INTEGER (this will fail if data exists)
    await queryInterface.sequelize.query(`
      ALTER TABLE thumbnails
      ALTER COLUMN "episodeId" TYPE INTEGER USING "episodeId"::integer;
    `);

    // Re-add foreign key (though it won't work with UUID episodes)
    await queryInterface.sequelize.query(`
      ALTER TABLE thumbnails
      ADD CONSTRAINT thumbnails_episodeId_fkey
      FOREIGN KEY ("episodeId")
      REFERENCES episodes(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `);

    // Re-add index
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_id ON thumbnails("episodeId");
    `);
  },
};
