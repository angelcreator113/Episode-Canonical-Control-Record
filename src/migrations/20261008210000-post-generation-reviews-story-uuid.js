'use strict';

/**
 * post_generation_reviews.story_id names the story it reviewed (Evoni's
 * ruling, 2026-10-08: keep the post-generation review and wire it up).
 *
 * It was an INTEGER, and storyteller_stories.id is a UUID, so a review could
 * never name its story: POST /reviews/post-generation saved parseInt of the
 * story's id (3 for '3f2a…'; an id starting with a letter failed). No saved
 * row can be traced to its story, so the rows are cleared, and story_id
 * becomes a UUID referencing storyteller_stories. ON DELETE CASCADE: a
 * deleted story's reviews go with it.
 *
 * Guarded: when story_id is already a UUID, nothing changes, so a re-run is
 * safe. down makes it an INTEGER again and clears the rows again (a UUID
 * does not fit in one).
 */

const TABLE = 'post_generation_reviews';
const FK = 'post_generation_reviews_story_id_fkey';

const storyIdType = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    "SELECT data_type FROM information_schema.columns WHERE table_name = :table AND column_name = 'story_id'",
    { replacements: { table: TABLE }, transaction });
  return rows[0] ? rows[0].data_type : null;
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const type = await storyIdType(sequelize, transaction);
      if (!type || type === 'uuid') return;
      await sequelize.query(`DELETE FROM ${TABLE}`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} ALTER COLUMN story_id TYPE UUID USING NULL`, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${FK} FOREIGN KEY (story_id)
           REFERENCES storyteller_stories (id) ON UPDATE CASCADE ON DELETE CASCADE`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const type = await storyIdType(sequelize, transaction);
      if (type !== 'uuid') return;
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${FK}`, { transaction });
      await sequelize.query(`DELETE FROM ${TABLE}`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} ALTER COLUMN story_id TYPE INTEGER USING NULL`, { transaction });
    });
  },
};
