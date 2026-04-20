'use strict';

/**
 * Add columns to store an AI-regenerated "product shot" variant of a wardrobe
 * item — separate from s3_url (original upload) and s3_url_processed
 * (background-removed cutout). The regenerated variant is produced by Flux
 * Kontext (image-to-image) with a prompt that asks for studio lighting,
 * neutral backdrop, and an invisible-mannequin pose — so amateur uploads
 * (hangers, closets) end up looking closer to the vendor product shots that
 * already exist in the library.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('wardrobe', 's3_key_regenerated', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'S3 key for AI-regenerated product-shot variant',
    });

    await queryInterface.addColumn('wardrobe', 's3_url_regenerated', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Full S3 URL for AI-regenerated product-shot variant',
    });

    await queryInterface.addColumn('wardrobe', 'regeneration_status', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Status of product-shot regeneration: pending | success | failed',
    });

    await queryInterface.addColumn('wardrobe', 'regeneration_error', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Error message when regeneration_status = failed (HTTP status + body)',
    });

    await queryInterface.addColumn('wardrobe', 'regenerated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp of most recent successful regeneration',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('wardrobe', 'regenerated_at');
    await queryInterface.removeColumn('wardrobe', 'regeneration_error');
    await queryInterface.removeColumn('wardrobe', 'regeneration_status');
    await queryInterface.removeColumn('wardrobe', 's3_url_regenerated');
    await queryInterface.removeColumn('wardrobe', 's3_key_regenerated');
  },
};
