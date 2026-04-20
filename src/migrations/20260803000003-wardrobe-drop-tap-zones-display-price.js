'use strict';

/**
 * Drop `wardrobe.tap_zones` and `wardrobe.display_price_on_phone`.
 *
 * Added 3 commits earlier in #580, never shipped a consumer. The UI
 * overlay subsystem already owns tap zones (Asset.metadata.screen_links
 * on overlay_type='…' rows) with a working editor at
 * frontend/src/pages/UIOverlaysTab.jsx — duplicating that surface on the
 * wardrobe row would mean reinventing the same feature on the wrong side
 * of the "item vs screen" boundary and then having to reconcile the two.
 *
 * The backdrop-variant columns added in the same migration stay — those
 * are artwork (item-level, episode-independent, reusable across any
 * screen that wants to feature the item). It's only the tap/price
 * columns that move home.
 *
 * Follow-up work creates a "Send to phone" action that promotes a
 * wardrobe item's chosen colored variant into a new Asset (overlay_type
 * wardrobe_detail), where tap zones and price display already belong.
 */

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('wardrobe', 'display_price_on_phone');
    await queryInterface.removeColumn('wardrobe', 'tap_zones');
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add with the same shape as the original migration in case someone
    // needs to roll forward-then-back. Any data that was in the columns
    // when the up() ran is gone and won't be restored — this is just about
    // schema symmetry.
    await queryInterface.addColumn('wardrobe', 'tap_zones', {
      type: Sequelize.JSONB, allowNull: true, defaultValue: [],
    });
    await queryInterface.addColumn('wardrobe', 'display_price_on_phone', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },
};
