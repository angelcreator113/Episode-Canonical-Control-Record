'use strict';

/**
 * Add wardrobe binding to world_events so the outfit picked when an
 * event is created flows through to any episode that links the event.
 *
 * Episode → Event link already exists (WorldEvent.used_in_episode_id),
 * and locations on events are read through to the episode the same way.
 * Wardrobe is the one piece that didn't have an event-side field — the
 * frontend was reading `linkedEvent.outfit_pieces` against a column that
 * didn't exist, so saved outfits never reached the episode page.
 *
 * Two fields:
 *   outfit_set_id   — optional FK to outfit_sets, when the creator
 *                     picked a saved set (e.g. "Brunch Look 2")
 *   outfit_pieces   — JSONB array of wardrobe item IDs / inline pieces,
 *                     covers the case where creators pick individual
 *                     pieces ad-hoc rather than a saved set
 *
 * Both nullable; legacy rows untouched.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('world_events').catch(() => ({}));
    if (!table.outfit_set_id) {
      await queryInterface.addColumn('world_events', 'outfit_set_id', {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'FK to outfit_sets when the event uses a saved outfit',
      });
    }
    if (!table.outfit_pieces) {
      await queryInterface.addColumn('world_events', 'outfit_pieces', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of wardrobe item IDs (or inline {name, image_url}) for this event',
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('world_events').catch(() => ({}));
    if (table.outfit_set_id) await queryInterface.removeColumn('world_events', 'outfit_set_id');
    if (table.outfit_pieces) await queryInterface.removeColumn('world_events', 'outfit_pieces');
  },
};
