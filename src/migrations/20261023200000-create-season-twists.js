'use strict';

/**
 * season_twists (Evoni, 2026-10-23: the approved plan "from a finished
 * script to the story to the next episode", PR 3; "Season twists as their
 * own list").
 *
 * A twist is planted in one season slot (season_slots) and paid off in a
 * later one. The script writer for the plant slot's episode is told to
 * plant it, subtly and unexplained; the writer for the payoff slot's
 * episode is told to pay it off. The reveal plan (season_reveals) stays
 * as it is: it plans character secrets; a twist is the season's own.
 *   arc_id          the season (show_arcs) it was planned in; null when unknown
 *   plant_slot_id   the slot that plants it
 *   payoff_slot_id  the later slot that pays it off; null while undecided
 *   status          planned | planted | paid_off | dropped
 *   thread_ids      show_story_threads ids it belongs to (jsonb array)
 *   character_ids   registry_characters ids it involves (jsonb array)
 *   planted_episode_id / paid_off_episode_id  the episodes that did it
 *
 * Raw SQL in services/seasonTwists; no model (as season_reveals). Guarded:
 * created only when absent. down drops it.
 */

const TABLE = 'season_twists';

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
        show_id: { type: Sequelize.UUID, allowNull: false },
        arc_id: { type: Sequelize.UUID, allowNull: true },
        title: { type: Sequelize.STRING(200), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        plant_slot_id: { type: Sequelize.UUID, allowNull: false },
        payoff_slot_id: { type: Sequelize.UUID, allowNull: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'planned' },
        thread_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        character_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        planted_episode_id: { type: Sequelize.UUID, allowNull: true },
        paid_off_episode_id: { type: Sequelize.UUID, allowNull: true },
        note: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_status_check CHECK (status IN ('planned', 'planted', 'paid_off', 'dropped'))`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_show ON ${TABLE} (show_id) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_plant_slot ON ${TABLE} (plant_slot_id) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_payoff_slot ON ${TABLE} (payoff_slot_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
