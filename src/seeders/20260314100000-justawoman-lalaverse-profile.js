'use strict';

/**
 * JustAWoman's LalaVerse Record — retired.
 *
 * Evoni, 2026-10-15: "remove it since Lala doesn't know she exists"
 * (docs/CANON.md). Migration 20261015190000-remove-justawoman-lalaverse-profile
 * soft-deletes the row this seeder made; up no longer inserts one. Down
 * still removes a row an earlier run left, as before.
 */
module.exports = {
  async up() {},

  async down(queryInterface) {
    await queryInterface.bulkDelete('social_profiles', {
      is_justawoman_record: true,
      feed_layer: 'lalaverse',
    });
  },
};
