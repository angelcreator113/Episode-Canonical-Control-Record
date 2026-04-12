'use strict';

/**
 * Add distribution fields to shows and episodes.
 *
 * shows.distribution_defaults — show-level platform config (templates, hashtags, accounts)
 * episodes.distribution_metadata — per-episode platform descriptions, hashtags, schedule
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('shows', 'distribution_defaults', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    }).catch(() => {});

    await queryInterface.addColumn('episodes', 'distribution_metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('shows', 'distribution_defaults').catch(() => {});
    await queryInterface.removeColumn('episodes', 'distribution_metadata').catch(() => {});
  },
};
