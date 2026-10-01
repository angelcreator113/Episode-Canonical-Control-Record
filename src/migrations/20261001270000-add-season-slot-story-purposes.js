'use strict';

/**
 * Up to three story purposes per season slot (Evoni's ruling A10,
 * 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(ff)):
 *
 *   A10. "A slot can hold up to three story purposes, one marked primary,
 *   each optionally tied to a story thread. Desired pressure and the
 *   outcome range stay single per slot. The script writer receives all
 *   purposes, primary first; the roadmap card shows the primary with
 *   "+N more"."
 *
 * 1. season_slots.story_purposes (JSONB, nullable): primary first,
 *      [{ text, primary, story_thread_id }]   (1 to 3 entries)
 *    story_purpose and story_thread_id stay, as the primary purpose's
 *    mirror, so every reader of the primary keeps working.
 * 2. Backfill: a slot with a story purpose and no story_purposes gets
 *    [{ text: story_purpose, primary: true, story_thread_id }]. Logs its
 *    count.
 *
 * Guarded: the column is added only when absent; the backfill skips slots
 * that already have story_purposes, so a re-run changes nothing. down drops
 * the column (the primary's mirror columns are untouched).
 */

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const hasColumn = async (sequelize, transaction) => {
  const [cols] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'season_slots' AND column_name = 'story_purposes'`,
    { transaction });
  return cols.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'season_slots', transaction))) return;
      if (!(await hasColumn(sequelize, transaction))) {
        await queryInterface.addColumn('season_slots', 'story_purposes', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
      const [, meta] = await sequelize.query(
        `UPDATE season_slots
            SET story_purposes = jsonb_build_array(jsonb_build_object(
                  'text', story_purpose, 'primary', true, 'story_thread_id', story_thread_id))
          WHERE story_purposes IS NULL AND story_purpose IS NOT NULL AND btrim(story_purpose) <> ''`,
        { transaction });
      const count = typeof meta?.rowCount === 'number' ? meta.rowCount : 0;
      console.log(`[migration 20261001270000] story_purposes backfilled on ${count} slot(s)`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, 'season_slots') && await hasColumn(sequelize)) {
      await queryInterface.removeColumn('season_slots', 'story_purposes');
    }
  },
};
