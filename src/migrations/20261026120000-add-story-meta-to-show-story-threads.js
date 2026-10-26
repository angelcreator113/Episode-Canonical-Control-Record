'use strict';

/**
 * Threads that open by themselves, and the one threads list (Evoni,
 * 2026-10-26: "How do we auto create threads that make sense with the
 * story" … "Let's let them open themselves on new threads and build the
 * threads list. I think that will help things move along").
 *
 * show_story_threads has no JSON column, and a self-opened thread needs to
 * say where it came from, whether Evoni has looked at it (its Undo lasts
 * until she does), why it matters, the part of the season it belongs to,
 * the slots suggested to carry it on and pay it off, and its notes. One
 * column holds all of it (services/threadInbox):
 *
 *   show_story_threads.story_meta   JSONB, nullable
 *     origin      { kind: script | seed | short_story | feed | evoni,
 *                   episode_id, episode_number, beat, event_name, label }
 *     opened_by   'itself' | 'evoni'
 *     seen_at     when Evoni looked at it (Undo ends)
 *     why, part   the check's one line and the season part (phase number)
 *     plan        { carry_slot_id, payoff_slot_id, by: ai | plain | evoni }
 *     notes       [{ key, text, at, episode_id, label, auto, seen_at, undone_at, prev }]
 *     left_out    { reason, at }   a candidate the check left out (the row is soft-deleted)
 *     undone_at   Evoni undid a self-opened thread (the row is soft-deleted)
 *     check       { by: ai | plain }
 *
 * An added column, so no deleted_at (the table has its own). Guarded: added
 * only when absent. down drops it.
 *
 * Runs only through Evoni's Deploy workflow; until it has, threads do not
 * open by themselves and the app works as before (threadInbox.hasMeta).
 */

const COLUMN = 'story_meta';

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'show_story_threads' AND column_name = :column",
    { replacements: { column: COLUMN }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, transaction))) {
        await queryInterface.addColumn('show_story_threads', COLUMN, { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) {
        await queryInterface.removeColumn('show_story_threads', COLUMN, { transaction });
      }
    });
  },
};
