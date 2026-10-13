'use strict';

/**
 * pulse_requests: The Pulse's daily request ledger (Task #3031; Evoni,
 * 2026-10-12: "20 AI text-generation requests per show. Start with 5
 * automated requests, leaving 15 for manual work … Count regenerations";
 * docs/reads/2026-10-12-pulse-decisions-read.md §3). One row per drafting
 * call, taken by services/pulseRequests.js before the call.
 *
 *   lane     automated | manual
 *   kind     event | ambient | comment | storyline | dm | voice |
 *            suggestions | reactions | redraft
 *   job_id   the queue job that made the call, when there is one
 *
 * New table only, with deleted_at. Guarded: created only when absent.
 *
 * Settings: shows.metadata.pulse_engine.daily_draft_cap (drafts a day,
 * default 30) is rewritten once to { automated_requests, manual_requests }.
 * A show that had set a cap below 5 keeps it as its automated limit (0 stays
 * off); every other show gets the ruled 5. Manual is 15. down drops the
 * table and puts daily_draft_cap back at its default.
 */

const TABLE = 'pulse_requests';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, TABLE, transaction))) {
        await queryInterface.createTable(TABLE, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
          lane: { type: Sequelize.STRING(10), allowNull: false },
          kind: { type: Sequelize.STRING(20), allowNull: false },
          job_id: { type: Sequelize.UUID, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await queryInterface.addIndex(TABLE, ['show_id', 'lane', 'created_at'], { name: 'pulse_requests_show_lane_created', transaction });
      }
      // The old draft cap, once, to the new shape. Only shows that saved engine settings have the key.
      await sequelize.query(
        `UPDATE shows SET metadata = jsonb_set(metadata::jsonb, '{pulse_engine}',
            (metadata::jsonb -> 'pulse_engine') - 'daily_draft_cap'
              || jsonb_build_object(
                   'automated_requests', LEAST(5, GREATEST(0, COALESCE((metadata::jsonb #>> '{pulse_engine,daily_draft_cap}')::int, 5))),
                   'manual_requests', 15))::json
          WHERE metadata IS NOT NULL AND (metadata::jsonb -> 'pulse_engine') ? 'daily_draft_cap'`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `UPDATE shows SET metadata = jsonb_set(metadata::jsonb, '{pulse_engine}',
            ((metadata::jsonb -> 'pulse_engine') - 'automated_requests' - 'manual_requests') || '{"daily_draft_cap": 30}'::jsonb)::json
          WHERE metadata IS NOT NULL AND (metadata::jsonb -> 'pulse_engine') ? 'automated_requests'`,
        { transaction });
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
