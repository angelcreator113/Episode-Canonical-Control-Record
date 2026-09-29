'use strict';

/**
 * Career Rate Anchors and premiums (deal build PR 1, M-3; Task #2319).
 * Replaces DEAL_DESIGN.md §8's empty deal_pricing tables with Evoni's answer
 * to QUESTION 4 (2026-09-29, docs/EVENT_EPISODE_FLOW.md §8(cc)):
 *
 *   "Adopt five Career Rate Anchors—Emerging, Rising, Established,
 *   Influential and Elite. Rates are baselines, not fixed payouts."
 *
 * deal_rate_anchors: one baseline per (version, component, career_tier),
 * career_tier 1–5 = Emerging … Elite (src/utils/careerTiers.js). amount is
 * null where the ruling gives "—" (brand partnership base at Emerging).
 *
 * deal_rate_premiums: percent added to the one component a premium affects
 * (rush, usage, exclusivity, paid_ad). paid_ad's percent is null: the ruling
 * makes paid-ad/whitelisting "a separate premium" and gives no number.
 * Travel (a reimbursement) and gifted product (non-cash value) are not
 * premiums and are not here.
 *
 * Version 1 is seeded from the ruling's starting anchors, only when version
 * 1 has no rows, so a re-run never duplicates it. Guarded: each table is
 * created only when showAllTables lacks it. down drops both tables.
 */
const ANCHORS = {
  paid_appearance: [150, 250, 450, 650, 900],
  reel: [75, 125, 225, 325, 450],
  stories_3: [35, 60, 110, 160, 225],
  brand_partnership_base: [null, 500, 900, 1300, 1800],
  performance_booking: [100, 200, 400, 600, 850],
};

const PREMIUMS = [
  ['rush', '48h', 10], ['rush', '24h', 20],
  ['usage', '30d', 15], ['usage', '90d', 25],
  ['exclusivity', '7d', 10], ['exclusivity', '30d', 25], ['exclusivity', '90d', 40],
  ['paid_ad', 'whitelisting', null],
];

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  deleted_at: { type: Sequelize.DATE, allowNull: true },
});

module.exports = {
  ANCHORS,
  PREMIUMS,

  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const tables = (await queryInterface.showAllTables({ transaction })).map((t) => (typeof t === 'string' ? t : t.tableName));

      if (!tables.includes('deal_rate_anchors')) {
        await queryInterface.createTable('deal_rate_anchors', {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          version: { type: Sequelize.INTEGER, allowNull: false },
          component: { type: Sequelize.STRING(40), allowNull: false },
          career_tier: { type: Sequelize.INTEGER, allowNull: false },
          amount: { type: Sequelize.INTEGER, allowNull: true },
          ...timestamps(Sequelize),
        }, { transaction });
      }
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS deal_rate_anchors_version_component_tier
           ON deal_rate_anchors (version, component, career_tier) WHERE deleted_at IS NULL`,
        { transaction }
      );

      if (!tables.includes('deal_rate_premiums')) {
        await queryInterface.createTable('deal_rate_premiums', {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          version: { type: Sequelize.INTEGER, allowNull: false },
          kind: { type: Sequelize.STRING(20), allowNull: false },
          key: { type: Sequelize.STRING(40), allowNull: false },
          percent: { type: Sequelize.INTEGER, allowNull: true },
          ...timestamps(Sequelize),
        }, { transaction });
      }
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS deal_rate_premiums_version_kind_key
           ON deal_rate_premiums (version, kind, key) WHERE deleted_at IS NULL`,
        { transaction }
      );

      const [[{ n: anchorRows }]] = await sequelize.query(
        'SELECT COUNT(*)::int AS n FROM deal_rate_anchors WHERE version = 1', { transaction });
      if (anchorRows === 0) {
        for (const [component, amounts] of Object.entries(ANCHORS)) {
          for (const [i, amount] of amounts.entries()) {
            await sequelize.query(
              `INSERT INTO deal_rate_anchors (version, component, career_tier, amount)
               VALUES (1, :component, :tier, :amount)`,
              { replacements: { component, tier: i + 1, amount }, transaction });
          }
        }
      }

      const [[{ n: premiumRows }]] = await sequelize.query(
        'SELECT COUNT(*)::int AS n FROM deal_rate_premiums WHERE version = 1', { transaction });
      if (premiumRows === 0) {
        for (const [kind, key, percent] of PREMIUMS) {
          await sequelize.query(
            `INSERT INTO deal_rate_premiums (version, kind, key, percent) VALUES (1, :kind, :key, :percent)`,
            { replacements: { kind, key, percent }, transaction });
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS deal_rate_premiums');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS deal_rate_anchors');
  },
};
