'use strict';

/**
 * The public recap's images (Task #3099; Evoni, 2026-10-13: the bucket
 * first, then images; public assets separate from private drafts):
 *   pulse_recaps.images  JSONB { <post id>: { key, source } | { failed, source } }
 * Each recap post's image as The Pulse showed it at publishing, copied into
 * the public site bucket (SITE_PUBLIC_BUCKET) under `key`; `source` is the
 * image it was copied from, so the public page shows the copy only while The
 * Pulse still shows that image (services/pulseRecap.js).
 *
 * Additive and guarded; down removes the column (the copies stay in the bucket).
 */

const TABLE = 'pulse_recaps';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable(TABLE);
    if (!columns.images) {
      await queryInterface.addColumn(TABLE, 'images', { type: Sequelize.JSONB, allowNull: false, defaultValue: {} });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(TABLE);
    if (columns.images) await queryInterface.removeColumn(TABLE, 'images');
  },
};
