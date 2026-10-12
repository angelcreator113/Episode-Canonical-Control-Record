'use strict';

/**
 * pulse_jobs: The Pulse's posting queue (Task #2968; The Pulse spec §7 "Cost
 * control: a daily generation cap; jobs run through a queue, never in a live
 * request"; docs/reads/2026-10-12-pulse-posting-read.md §4-5). Every AI
 * draft runs as a job here, claimed by the Pulse worker
 * (services/pulseQueue.js), the way workers/sceneGenerationWorker.js claims
 * generation_jobs.
 *
 *   kind          event | ambient | comment
 *   payload_json  what the handler needs (character, moment, post, …)
 *   status        queued | running | done | failed | skipped
 *   run_after     not before this time (retries back off)
 *   draft_ids     the drafts the job made; the daily cap counts them
 *
 * New table only, with deleted_at. Guarded: created only when absent. down
 * drops it.
 */

const TABLE = 'pulse_jobs';

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
        kind: { type: Sequelize.STRING(20), allowNull: false },
        payload_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'queued' },
        attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        max_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
        error: { type: Sequelize.TEXT, allowNull: true },
        run_after: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        started_at: { type: Sequelize.DATE, allowNull: true },
        finished_at: { type: Sequelize.DATE, allowNull: true },
        draft_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await queryInterface.addIndex(TABLE, ['status', 'run_after'], { name: 'pulse_jobs_status_run_after', transaction });
      await queryInterface.addIndex(TABLE, ['show_id', 'finished_at'], { name: 'pulse_jobs_show_finished', transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
