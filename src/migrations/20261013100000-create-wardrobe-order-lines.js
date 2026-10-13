'use strict';

/**
 * Real-world order lines imported from Amazon's order history CSV (Task
 * #3102; Evoni, 2026-10-13: "Amazon CSV first, with manual entry kept.
 * Preview, confirm, detect duplicates and match to pieces. Never deduct
 * Lala's coins.").
 *
 *   wardrobe_order_lines  one row per order id + ASIN: the date, product
 *                         name, price paid, list price, quantity, currency
 *                         and site; its wardrobe piece once matched
 *                         (status matched | unmatched). The unique index
 *                         is the duplicate check.
 *
 * No address, payment or email from the file is stored. Nothing in-world
 * reads this table (spec rule 7). Guarded and reversible.
 */

const TABLE = 'wardrobe_order_lines';

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS t', { replacements: { name: TABLE }, transaction });
  return Boolean(rows[0]?.t);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, transaction)) return;
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
        show_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'shows', key: 'id' }, onDelete: 'SET NULL' },
        order_id: { type: Sequelize.STRING(40), allowNull: false },
        asin: { type: Sequelize.STRING(20), allowNull: false },
        title: { type: Sequelize.TEXT, allowNull: false },
        order_date: { type: Sequelize.DATEONLY, allowNull: true },
        price_paid: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        list_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        currency: { type: Sequelize.STRING(8), allowNull: true },
        website: { type: Sequelize.STRING(40), allowNull: true },
        wardrobe_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'wardrobe', key: 'id' }, onDelete: 'SET NULL' },
        status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'unmatched' },
        matched_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX wardrobe_order_lines_once ON ${TABLE} (order_id, asin) WHERE deleted_at IS NULL`, { transaction });
      await queryInterface.addIndex(TABLE, ['status'], { name: 'wardrobe_order_lines_status', transaction });
      await queryInterface.addIndex(TABLE, ['wardrobe_id'], { name: 'wardrobe_order_lines_piece', transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
