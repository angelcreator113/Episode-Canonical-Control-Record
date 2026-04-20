'use strict';

/**
 * Let a wardrobe row remember which of its three image variants the user
 * prefers the grid card to show:
 *   - 'original'    → s3_url (raw upload)
 *   - 'processed'   → s3_url_processed (remove.bg cutout)
 *   - 'regenerated' → s3_url_regenerated (Flux Kontext studio shot)
 *
 * NULL means "use the default preference" (regenerated > processed > original),
 * which matches historical behavior — rows written before this migration keep
 * working without modification.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('wardrobe', 'primary_image_variant', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'User-selected preferred variant: original | processed | regenerated (NULL = auto, latest wins)',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('wardrobe', 'primary_image_variant');
  },
};
