'use strict';

/**
 * pulse_closeness: the closeness ledger (Task #2983; The Pulse spec §9
 * "Repeated interactions (or ignored ones) adjust Relationship Map closeness
 * by small amounts, each change recorded with its cause, proposed and
 * approved like numbers"; docs/reads/2026-10-12-pulse-world-depth-read.md
 * §2). No relationship table holds a closeness number, and the map and The
 * Pulse read different ones, so closeness is a ledger of its own, keyed on
 * the pair of Feed profiles (profile_a_id < profile_b_id). A pair starts at
 * its relationship type's closeness (services/pulseCloseness.js); each row
 * moves it.
 *
 *   story_order      when the change takes effect (services/storyClock.js)
 *   delta            signed; closeness_after the pair's closeness once it applies (0–1)
 *   cause            comment | mention | ignored | override
 *   source_id        what caused it (a comment, a post); one row per pair, cause and source
 *   status           proposed | accepted | rejected
 *
 * New table only, with deleted_at. Guarded: created only when absent. down
 * drops it.
 */

const TABLE = 'pulse_closeness';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) return;
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
        show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
        profile_a_id: { type: Sequelize.INTEGER, allowNull: false },
        profile_b_id: { type: Sequelize.INTEGER, allowNull: false },
        story_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        delta: { type: Sequelize.DECIMAL(5, 3), allowNull: false, defaultValue: 0 },
        closeness_after: { type: Sequelize.DECIMAL(5, 3), allowNull: true },
        cause: { type: Sequelize.STRING(20), allowNull: false },
        source_id: { type: Sequelize.STRING(80), allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'proposed' },
        decided_by: { type: Sequelize.STRING(255), allowNull: true },
        decided_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await queryInterface.addIndex(TABLE, ['show_id', 'profile_a_id', 'profile_b_id', 'story_order'], { name: 'pulse_closeness_pair_order', transaction });
      await queryInterface.addIndex(TABLE, ['show_id', 'status'], { name: 'pulse_closeness_status', transaction });
      // One change per pair, cause and source: proposing again is a no-op.
      await sequelize.query(
        `CREATE UNIQUE INDEX pulse_closeness_one_per_source ON ${TABLE} (show_id, profile_a_id, profile_b_id, cause, source_id)
          WHERE source_id IS NOT NULL AND deleted_at IS NULL`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
