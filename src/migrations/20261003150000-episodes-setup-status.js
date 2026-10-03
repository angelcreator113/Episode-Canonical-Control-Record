'use strict';

/**
 * episodes.setup_status (audit STATE-01, 2026-10-03): what Start Episode's
 * downstream setup did, step by step, so a partly initialised episode is
 * visibly incomplete and can be repaired without a second episode.
 *
 *   { complete: boolean, updated_at, steps: { scene_plan: { status:
 *     'complete' | 'partial' | 'failed', created, existing, failed:
 *     [{ beat, reason }] }, locations: { status, reason? } } }
 *
 * The episode, its brief and the event stamp are one transaction and need
 * no record; the steps after it were logged and lost. Guarded; down removes
 * the column.
 */

const TABLE = 'episodes';
const COLUMN = 'setup_status';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(TABLE).catch(() => null);
    if (!table || table[COLUMN]) return;
    await queryInterface.addColumn(TABLE, COLUMN, { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable(TABLE).catch(() => null);
    if (!table || !table[COLUMN]) return;
    await queryInterface.removeColumn(TABLE, COLUMN);
  },
};
