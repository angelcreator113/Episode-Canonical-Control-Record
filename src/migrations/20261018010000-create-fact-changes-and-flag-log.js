'use strict';

/**
 * Two logs for the Character Consistency Engine (the spec's Future
 * Enhancements #1 and #4; Evoni, 2026-10-17: "start the fact history and
 * flag log"):
 *
 * character_fact_changes: every change to a character's facts made on the
 * fact sheet (handle, account status, income, occupation, what they own,
 * what is not decided yet), with what it was, what it became, why, who
 * changed it and the story moment it happened at (story_order, the story
 * clock). Followers are not here: their history is the follower ledger
 * (pulse_followers), which the history view reads alongside. Raw SQL in
 * services/factHistory; no model.
 *
 * consistency_flag_log: every flag the consistency check has raised, one
 * row per character, check source and flag id, kept after it is resolved:
 * first and last seen, how many checks saw it, and its status: open,
 * fixed (Evoni used Fix or Edit the text), gone (the text changed and the
 * flag no longer appears), intentional (marked "it's intentional"). Over
 * time it maps where the generators break most. Raw SQL in
 * services/flagLog; no model.
 *
 * Guarded: each table is created only when absent. down drops both.
 */

const FACTS = 'character_fact_changes';
const FLAGS = 'consistency_flag_log';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, FACTS, transaction))) {
        await queryInterface.createTable(FACTS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          registry_character_id: { type: Sequelize.UUID, allowNull: false },
          show_id: { type: Sequelize.UUID, allowNull: true },
          fact_key: { type: Sequelize.STRING(40), allowNull: false },
          before_value: { type: Sequelize.JSONB, allowNull: true },
          after_value: { type: Sequelize.JSONB, allowNull: true },
          reason: { type: Sequelize.TEXT, allowNull: true },
          story_order: { type: Sequelize.INTEGER, allowNull: true },
          changed_by: { type: Sequelize.STRING(255), allowNull: true },
          source: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'fact_sheet' },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await sequelize.query(
          `CREATE INDEX IF NOT EXISTS ${FACTS}_character ON ${FACTS} (registry_character_id, created_at) WHERE deleted_at IS NULL`,
          { transaction });
      }
      if (!(await tableExists(sequelize, FLAGS, transaction))) {
        await queryInterface.createTable(FLAGS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          registry_character_id: { type: Sequelize.UUID, allowNull: false },
          registry_id: { type: Sequelize.UUID, allowNull: true },
          source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'check' },
          flag_id: { type: Sequelize.STRING(40), allowNull: false },
          check_key: { type: Sequelize.STRING(40), allowNull: false },
          field: { type: Sequelize.STRING(255), allowNull: true },
          field_label: { type: Sequelize.STRING(255), allowNull: true },
          found: { type: Sequelize.TEXT, allowNull: true },
          expected: { type: Sequelize.TEXT, allowNull: true },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'open' },
          times_seen: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          first_seen_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          last_seen_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          resolved_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await sequelize.query(
          `ALTER TABLE ${FLAGS}
             ADD CONSTRAINT ${FLAGS}_status CHECK (status IN ('open', 'fixed', 'gone', 'intentional'))`,
          { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${FLAGS}_one ON ${FLAGS} (registry_character_id, source, flag_id)`,
          { transaction });
        await sequelize.query(
          `CREATE INDEX IF NOT EXISTS ${FLAGS}_registry ON ${FLAGS} (registry_id, check_key) WHERE deleted_at IS NULL`,
          { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, FLAGS, transaction)) await queryInterface.dropTable(FLAGS, { transaction });
      if (await tableExists(sequelize, FACTS, transaction)) await queryInterface.dropTable(FACTS, { transaction });
    });
  },
};
