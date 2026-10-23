'use strict';

/**
 * One truth for relationships (Evoni, 2026-10-23: "We need to make sure
 * everywhere relationships are mentioned all information is the same").
 *
 *   1. social_profile_relationships.character_relationship_id: the story
 *      pair (character_relationships) a Pulse pair is the online side of.
 *      Nullable (a Pulse pair between two people with no registry characters
 *      has none), indexed, ON DELETE SET NULL.
 *   2. relationship_drift_keeps: the disagreements Evoni marked "different
 *      on purpose" on the drift report (services/relationshipTruth), keyed
 *      by the report item, with what each store said when she kept it, so a
 *      later change brings the item back.
 *   3. The link is backfilled (relationshipTruth.linkStoryAndPulse): a Pulse
 *      pair is linked to the story pair of the same two people when both
 *      have a registry character with that profile (feed_profile_id).
 *      Rows already linked are left alone, so it can run again.
 *
 * Guarded: each step only when absent. down removes the table and the column.
 */

const PULSE = 'social_profile_relationships';
const COLUMN = 'character_relationship_id';
const KEEPS = 'relationship_drift_keeps';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};
const columnExists = async (sequelize, table, column, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column',
    { replacements: { table, column }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, PULSE, transaction) && !(await columnExists(sequelize, PULSE, COLUMN, transaction))) {
        await sequelize.query(
          `ALTER TABLE ${PULSE} ADD COLUMN ${COLUMN} UUID NULL REFERENCES character_relationships(id) ON DELETE SET NULL`,
          { transaction });
      }
      if (await columnExists(sequelize, PULSE, COLUMN, transaction)) {
        await sequelize.query(`CREATE INDEX IF NOT EXISTS spr_character_relationship ON ${PULSE} (${COLUMN})`, { transaction });
      }
      if (!(await tableExists(sequelize, KEEPS, transaction))) {
        await queryInterface.createTable(KEEPS, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          drift_key: { type: Sequelize.STRING(200), allowNull: false, unique: true },
          signature: { type: Sequelize.TEXT, allowNull: false },
          said: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
          note: { type: Sequelize.TEXT, allowNull: true },
          kept_by: { type: Sequelize.STRING(255), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      if (await columnExists(sequelize, PULSE, COLUMN, transaction)
          && await tableExists(sequelize, 'character_relationships', transaction)) {
        const { linked } = await require('../services/relationshipTruth').linkStoryAndPulse(sequelize, { transaction });
        console.log(`[migration 20261023230100] linked ${linked} Pulse pair(s) to their story pair`);
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`DROP TABLE IF EXISTS ${KEEPS}`, { transaction });
      await sequelize.query('DROP INDEX IF EXISTS spr_character_relationship', { transaction });
      if (await columnExists(sequelize, PULSE, COLUMN, transaction)) {
        await sequelize.query(`ALTER TABLE ${PULSE} DROP COLUMN ${COLUMN}`, { transaction });
      }
    });
  },
};
