'use strict';

/**
 * wardrobe: the real-world source of a piece (Task #2872), stored alongside
 * its LalaVerse fields and read by nothing in-world.
 *
 * Eleven nullable columns, no ENUMs, no backfill:
 *   real_brand, real_retailer, real_product_name, real_color, real_size
 *     STRING (VARCHAR 255)
 *   real_price_paid, real_list_price   DECIMAL(10,2)
 *   real_product_url, affiliate_url    TEXT
 *   real_order_date                    DATEONLY (DATE)
 *   real_source                        STRING; values used: gmail,
 *                                      amazon_export, manual
 *
 * These are not twins of brand, price, purchase_link, website, color and
 * size: those are the piece's in-world fields (price is the fallback for the
 * look's coin cost; brand is written into scripts and feed posts), so real
 * purchases kept there would change in-world behaviour.
 *
 * wardrobe.deleted_at already exists (20260217000001-fix-wardrobe-schema-gaps)
 * and is not added again. Guarded: each column is added only when absent.
 * down drops exactly these eleven.
 */

const COLUMNS = (Sequelize) => ({
  real_brand: { type: Sequelize.STRING, allowNull: true },
  real_retailer: { type: Sequelize.STRING, allowNull: true },
  real_product_name: { type: Sequelize.STRING, allowNull: true },
  real_color: { type: Sequelize.STRING, allowNull: true },
  real_size: { type: Sequelize.STRING, allowNull: true },
  real_price_paid: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
  real_list_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
  real_product_url: { type: Sequelize.TEXT, allowNull: true },
  affiliate_url: { type: Sequelize.TEXT, allowNull: true },
  real_order_date: { type: Sequelize.DATEONLY, allowNull: true },
  real_source: { type: Sequelize.STRING, allowNull: true },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existing = await queryInterface.describeTable('wardrobe', { transaction });
      for (const [name, spec] of Object.entries(COLUMNS(Sequelize))) {
        if (!existing[name]) await queryInterface.addColumn('wardrobe', name, spec, { transaction });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existing = await queryInterface.describeTable('wardrobe', { transaction });
      for (const name of Object.keys(COLUMNS(Sequelize))) {
        if (existing[name]) await queryInterface.removeColumn('wardrobe', name, { transaction });
      }
    });
  },
};
