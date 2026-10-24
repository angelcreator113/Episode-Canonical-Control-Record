'use strict';

/**
 * Relationship seeds, better (Evoni, 2026-10-24: "How can we improve
 * relationship seeds", then "I want them all"). A seed is an unconfirmed
 * character_relationships row; these columns say where it came from, why,
 * and what Evoni did with it:
 *
 *   seed_source     generate | family | scene | pulse | manual; null for older rows
 *   seed_why        one line for Evoni: why this pair, built on what
 *   seed_basis      { episodes:[{id,number,title}], threads:[{id,title}], twists:[{id,title}], facts:[string] }
 *   seed_state      null (pending) | kept ("Keep as idea") | later (dismissed as "too soon"); unconfirmed rows only
 *   dismiss_reason  wrong_for_them | too_soon | already_covered | not_this_type | other
 *   dismiss_note    optional words with the reason
 *   seed_aim        what Generate was aimed at: { kind, focus_character_id, episode_id, twist_id }
 *
 * Every column is nullable and nothing is backfilled. The table already has
 * deleted_at (migration 20260309130000). Guarded: each column is added only
 * when absent. Down removes them.
 */

const TABLE = 'character_relationships';
const SOURCES = ['generate', 'family', 'scene', 'pulse', 'manual'];
const STATES = ['kept', 'later'];
const REASONS = ['wrong_for_them', 'too_soon', 'already_covered', 'not_this_type', 'other'];
const list = (values) => values.map((v) => `'${v}'`).join(', ');

const COLUMNS = (Sequelize) => ({
  seed_source: { type: Sequelize.STRING(20), allowNull: true },
  seed_why: { type: Sequelize.TEXT, allowNull: true },
  seed_basis: { type: Sequelize.JSONB, allowNull: true },
  seed_state: { type: Sequelize.STRING(20), allowNull: true },
  dismiss_reason: { type: Sequelize.STRING(30), allowNull: true },
  dismiss_note: { type: Sequelize.TEXT, allowNull: true },
  seed_aim: { type: Sequelize.JSONB, allowNull: true },
});

const CHECKS = {
  seed_source: [`${TABLE}_seed_source_check`, `seed_source IS NULL OR seed_source IN (${list(SOURCES)})`],
  seed_state: [`${TABLE}_seed_state_check`, `seed_state IS NULL OR seed_state IN (${list(STATES)})`],
  dismiss_reason: [`${TABLE}_dismiss_reason_check`, `dismiss_reason IS NULL OR dismiss_reason IN (${list(REASONS)})`],
};

module.exports = {
  SOURCES, STATES, REASONS,

  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const cols = await queryInterface.describeTable(TABLE);
      for (const [name, spec] of Object.entries(COLUMNS(Sequelize))) {
        if (cols[name]) continue;
        await queryInterface.addColumn(TABLE, name, spec, { transaction });
        if (CHECKS[name]) {
          const [constraint, condition] = CHECKS[name];
          await sequelize.query(`ALTER TABLE ${TABLE} ADD CONSTRAINT ${constraint} CHECK (${condition})`, { transaction });
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const cols = await queryInterface.describeTable(TABLE);
      for (const [constraint] of Object.values(CHECKS)) {
        await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${constraint}`, { transaction });
      }
      for (const name of Object.keys(COLUMNS(Sequelize))) {
        if (cols[name]) await queryInterface.removeColumn(TABLE, name, { transaction });
      }
    });
  },
};
