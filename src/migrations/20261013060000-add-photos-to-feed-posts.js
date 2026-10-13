'use strict';

/**
 * photos on feed_posts (Task #3089; Evoni, 2026-10-13: "Up to four photos.
 * One is the default; multiple photos become a swipeable carousel."): a
 * JSONB list of up to four { url, alt }, in order. image_url and
 * image_description stay the first photo, so teasers (cut from image_url)
 * and every older reader keep working. NULL: the post has only image_url,
 * or no photo.
 *
 * Additive and guarded: added only when absent. down removes it.
 */

const TABLE = 'feed_posts';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable(TABLE);
    if (!columns.photos) await queryInterface.addColumn(TABLE, 'photos', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(TABLE);
    if (columns.photos) await queryInterface.removeColumn(TABLE, 'photos');
  },
};
