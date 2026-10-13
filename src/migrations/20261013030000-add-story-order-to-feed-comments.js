'use strict';

/**
 * feed_comments.story_order: a comment's story time (Task #3064; The Pulse
 * spec §2 rule 2 "Every post, comment … carries a story-time stamp"; Evoni,
 * 2026-10-13). A comment is stamped with the moment it is made, never
 * earlier than its post (services/storyClock.js commentOrder); The Pulse at
 * a moment leaves out comments later than it.
 *
 * Existing comments take their post's story time (its story_order, else its
 * episode's number * 10 + its timeline_position's phase, during when none;
 * the phases as services/storyClock.js PHASES on 2026-10-13), so every
 * comment that shows today still shows with its post. Comments whose post
 * has no known story time stay NULL, which reads as the post's.
 *
 * Additive and guarded: the column is added only when absent. down removes it.
 */

const TABLE = 'feed_comments';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable(TABLE, { transaction });
      if (table.story_order) return;
      await queryInterface.addColumn(TABLE, 'story_order', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await sequelize.query(
        `UPDATE feed_comments fc
            SET story_order = COALESCE(fp.story_order, (
              SELECT e.episode_number * 10 + (CASE fp.timeline_position
                WHEN 'before_episode' THEN 1 WHEN 'announced' THEN 2 WHEN 'invitation_sent' THEN 3 WHEN 'lala_arrives' THEN 4
                WHEN 'during_episode' THEN 5 WHEN 'after_episode' THEN 7 WHEN 'next_day' THEN 8 WHEN 'week_later' THEN 9
                ELSE 5 END)
              FROM episodes e WHERE e.id = fp.episode_id))
           FROM feed_posts fp
          WHERE fp.id = fc.feed_post_id AND fc.story_order IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable(TABLE, { transaction });
      if (table.story_order) await queryInterface.removeColumn(TABLE, 'story_order', { transaction });
    });
  },
};
