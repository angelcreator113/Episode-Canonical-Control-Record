'use strict';

/**
 * Special episodes (Evoni, 2026-10-26: "Seems like sometimes we will have
 * special episodes to keep up with our events what's do you think?" —
 * "All three and on YouTube, show me first"). services/seasonSpecials.
 *
 * season_specials: one row per special episode or two-parter of a season.
 * The 24 weekly slots stay in season_slots, untouched: every season reader
 * that counts E1–E24 (parts, goal coverage, the next open slot, the phase
 * boundary, the twists, the reveal plan, the threads) keeps reading exactly
 * the rows it read before, and existing rows need no default.
 *
 *   kind               'bonus'     an event between two Sundays: its own
 *                                  episode after a weekly one ("Special ·
 *                                  after E7"), its own date and time; the
 *                                  weekly episodes keep their numbers and dates
 *                      'special'   a stand-alone special (holiday, recap,
 *                                  reunion): in Results and the wrap-up, not
 *                                  in the parts or the goal coverage
 *                      'two_part'  one event over two weekly slots
 *                                  (part_one_slot_id, part_two_slot_id);
 *                                  "E12 · Part 1/2", "E13 · Part 2/2"
 *   after_slot_number  bonus/special: the weekly episode it follows (0: before E1)
 *   special_type       special: holiday | recap | reunion | other
 *   title              bonus/special: its name (an event's name by default)
 *   event_id           bonus/special: the event it is made from (nullable)
 *   episode_id         bonus/special: the episode started from it (nullable)
 *   release_date, release_time   bonus/special: set by hand (YouTube, like
 *                      the main show; the weekly schedule never dates them)
 *   part_one_slot_id, part_two_slot_id   two_part: the two weekly slots
 *   locked_at, accepted_at, actual_outcome, actual_pressure   as season_slots
 *   timestamps, deleted_at (paranoid)
 *
 * Guarded: the table is created only when absent, and each index IF NOT
 * EXISTS, so a re-run changes nothing. down drops the table. Nothing is
 * written to existing rows. Runs only through Evoni's Deploy workflow.
 */

const TABLE = 'season_specials';

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) {
        await queryInterface.createTable(TABLE, {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
          arc_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'show_arcs', key: 'id' }, onDelete: 'CASCADE' },
          kind: { type: Sequelize.STRING(12), allowNull: false },
          after_slot_number: { type: Sequelize.INTEGER, allowNull: true },
          special_type: { type: Sequelize.STRING(20), allowNull: true },
          title: { type: Sequelize.TEXT, allowNull: true },
          event_id: { type: Sequelize.UUID, allowNull: true },
          episode_id: { type: Sequelize.UUID, allowNull: true },
          release_date: { type: Sequelize.DATEONLY, allowNull: true },
          release_time: { type: Sequelize.STRING(5), allowNull: true },
          part_one_slot_id: { type: Sequelize.UUID, allowNull: true },
          part_two_slot_id: { type: Sequelize.UUID, allowNull: true },
          locked_at: { type: Sequelize.DATE, allowNull: true },
          accepted_at: { type: Sequelize.DATE, allowNull: true },
          actual_outcome: { type: Sequelize.STRING(10), allowNull: true },
          actual_pressure: { type: Sequelize.STRING(10), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_kind_check CHECK (kind IN ('bonus', 'special', 'two_part'))`, { transaction });
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_type_check
             CHECK (special_type IS NULL OR special_type IN ('holiday', 'recap', 'reunion', 'other'))`, { transaction });
      }
      await sequelize.query(`CREATE INDEX IF NOT EXISTS ${TABLE}_arc ON ${TABLE} (arc_id) WHERE deleted_at IS NULL`, { transaction });
      await sequelize.query(`CREATE INDEX IF NOT EXISTS ${TABLE}_show ON ${TABLE} (show_id)`, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_episode_live ON ${TABLE} (episode_id)
           WHERE deleted_at IS NULL AND episode_id IS NOT NULL`, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_part_one_live ON ${TABLE} (part_one_slot_id)
           WHERE deleted_at IS NULL AND part_one_slot_id IS NOT NULL`, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_part_two_live ON ${TABLE} (part_two_slot_id)
           WHERE deleted_at IS NULL AND part_two_slot_id IS NOT NULL`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize)) await queryInterface.dropTable(TABLE);
  },
};
