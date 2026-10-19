'use strict';

/**
 * The rate card editor and agreed deals' frozen prices (Evoni, 2026-10-19:
 * "yes start the rate card after phase 4"). deal_rate_anchors and deal_rate_premiums already hold the card
 * as versioned data (20260929200002-create-deal-rate-anchors.js; the
 * "editor is a later PR" of dealPricingService ruling 5). An edit never
 * changes a version in place: it writes the next version, every row copied
 * with the edited cells changed (services/rateCard.saveRateCard), so a deal
 * priced from an earlier version still names what it was priced from
 * (world_events.pricing_version).
 *
 * deal_rate_card_versions records each version: who saved it, when, the
 * note, and the cells that changed ({ anchors: [{ component, career_tier,
 * from, to }], premiums: [{ kind, key, from, to }] }). The versions already
 * on the card (1 and 2, from the migrations) are recorded as seeded, so the
 * history starts complete. No price changes here.
 *
 * deal_price_snapshots (Evoni, 2026-10-19): an agreed deal's frozen prices,
 * one row per priced line, taken when its terms lock
 * (services/dealPriceSnapshot): line_kind/line_key, deliverable_type,
 * label, unit, career_tier and band, unit_price, quantity, total,
 * rate_anchor_id and rate_version, premiums, taken_at and reason. Rows are
 * never edited; a replaced snapshot is soft-deleted. Deals agreed before
 * this migration have none until their terms lock again.
 *
 * Guarded: each table is created only when absent; a version is seeded only
 * when it has no row yet. down drops both tables; the card itself is untouched.
 */

const SEEDED_NOTES = {
  1: 'Seeded: the five Career Rate Anchors (20260929200002-create-deal-rate-anchors).',
  2: 'Seeded: v1 plus the deliverable formats (20261001160000-add-deliverable-formats).',
};

module.exports = {
  SEEDED_NOTES,

  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const tables = (await queryInterface.showAllTables({ transaction })).map((t) => (typeof t === 'string' ? t : t.tableName));
      if (!tables.includes('deal_rate_card_versions')) {
        await queryInterface.createTable('deal_rate_card_versions', {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          version: { type: Sequelize.INTEGER, allowNull: false },
          note: { type: Sequelize.TEXT, allowNull: true },
          changes: { type: Sequelize.JSONB, allowNull: true },
          created_by_id: { type: Sequelize.STRING(255), allowNull: true },
          created_by_name: { type: Sequelize.STRING(255), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS deal_rate_card_versions_version
           ON deal_rate_card_versions (version) WHERE deleted_at IS NULL`,
        { transaction }
      );

      if (!tables.includes('deal_price_snapshots')) {
        await queryInterface.createTable('deal_price_snapshots', {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          event_id: { type: Sequelize.UUID, allowNull: false },
          line_kind: { type: Sequelize.STRING(20), allowNull: false },
          line_key: { type: Sequelize.STRING(64), allowNull: false },
          deliverable_type: { type: Sequelize.STRING(40), allowNull: true },
          label: { type: Sequelize.TEXT, allowNull: true },
          unit: { type: Sequelize.STRING(30), allowNull: true },
          career_tier: { type: Sequelize.INTEGER, allowNull: false },
          band: { type: Sequelize.STRING(20), allowNull: false },
          unit_price: { type: Sequelize.INTEGER, allowNull: true },
          quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          total: { type: Sequelize.INTEGER, allowNull: false },
          rate_anchor_id: { type: Sequelize.UUID, allowNull: true },
          rate_version: { type: Sequelize.INTEGER, allowNull: true },
          premiums: { type: Sequelize.JSONB, allowNull: true },
          taken_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          reason: { type: Sequelize.STRING(30), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS deal_price_snapshots_event ON deal_price_snapshots (event_id) WHERE deleted_at IS NULL`,
        { transaction }
      );

      if (!tables.includes('deal_rate_anchors')) return;
      const [versions] = await sequelize.query(
        `SELECT DISTINCT version FROM deal_rate_anchors WHERE deleted_at IS NULL ORDER BY version`, { transaction });
      for (const { version } of versions) {
        await sequelize.query(
          `INSERT INTO deal_rate_card_versions (version, note, created_by_name)
           SELECT :version, :note, 'migration'
            WHERE NOT EXISTS (SELECT 1 FROM deal_rate_card_versions WHERE version = :version AND deleted_at IS NULL)`,
          { replacements: { version, note: SEEDED_NOTES[version] || 'Seeded by a migration.' }, transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS deal_price_snapshots');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS deal_rate_card_versions');
  },
};
