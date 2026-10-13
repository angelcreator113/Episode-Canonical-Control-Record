'use strict';

/**
 * A post's location (Task #3090; Evoni, 2026-10-13: "Allow a Dream City or
 * a canonical venue. Selecting a venue automatically supplies its city."):
 *   place_city         a Dream City key (utils/feedCities DREAM_CITY_KEYS)
 *   place_location_id  a world_locations venue; its city fills place_city
 * Both NULL: no location (the post's city is its poster's, as before). A
 * tag never says Lala travelled there.
 *
 * Additive and guarded: each column is added only when absent. down removes them.
 */

const TABLE = 'feed_posts';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable(TABLE);
    if (!columns.place_city) await queryInterface.addColumn(TABLE, 'place_city', { type: Sequelize.STRING(40), allowNull: true });
    if (!columns.place_location_id) await queryInterface.addColumn(TABLE, 'place_location_id', { type: Sequelize.UUID, allowNull: true });
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(TABLE);
    if (columns.place_location_id) await queryInterface.removeColumn(TABLE, 'place_location_id');
    if (columns.place_city) await queryInterface.removeColumn(TABLE, 'place_city');
  },
};
