'use strict';

/**
 * A2 release position (Evoni's ruling R-1, "Choose A2: nullable
 * 'season_slots.release_position'"; docs/design/2026-11-season-planning.md
 * §4; migration authorized 2026-11-10).
 *
 * A slot's release number is COALESCE(release_position, slot_number).
 * slot_number stays the story slot: labels, story order, intentions and
 * season_context keep their meaning. This migration adds the column and its
 * integrity rules only. It writes no release_position: every row stays NULL,
 * so every release date is what it was. Nothing writes the column yet.
 *
 * 1. season_slots.release_position INTEGER NULL.
 * 2. season_slots_release_position_range:
 *      CHECK (release_position IS NULL OR release_position BETWEEN 1 AND 24)
 * 3. season_slots_effective_position_live: within a season, no two live slots
 *    share an effective position. Deferred to COMMIT, so two slots can trade
 *    positions inside one transaction.
 * 4. season_slots_episode_live: an episode is in at most one live slot.
 *    Deferred to COMMIT, so two slots can trade occupants.
 * The existing unique index season_slots_arc_slot_live (arc_id, slot_number)
 * is not touched.
 *
 * The three rules were proven on PostgreSQL 15, 16 and 17 before this file
 * was written (tests/integration/seasonReleasePositionConstraints…, K1-K14
 * and K17). A violated deferred rule fails the COMMIT with SQLSTATE 23P01.
 *
 * up refuses, changing nothing, when the existing rows already break rule 4
 * (rule 3 cannot be broken while every position is NULL, because of the
 * existing unique index). It reports a count only, never a row.
 *
 * down drops the three rules and the column. It refuses while any row has a
 * release_position: dropping the column then would silently move release
 * dates. Clear the positions first ("Back to story order"), then run it.
 *
 * Guarded: each step is skipped when already done, so a re-run changes
 * nothing. One transaction: all of it applies, or none.
 */

const TABLE = 'season_slots';
const RANGE = 'season_slots_release_position_range';
const POSITION = 'season_slots_effective_position_live';
const OCCUPANCY = 'season_slots_episode_live';

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = 'release_position'`,
    { replacements: { table: TABLE }, transaction });
  return rows.length > 0;
};

const constraintExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM pg_constraint WHERE conname = :name AND conrelid = to_regclass(:table)',
    { replacements: { name, table: `public.${TABLE}` }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) {
        throw new Error('[migration 20261110230000] season_slots does not exist; run 20261001230000-create-season-slots first.');
      }

      const [dupes] = await sequelize.query(
        `SELECT COUNT(*)::int AS n FROM (
           SELECT episode_id FROM ${TABLE}
            WHERE deleted_at IS NULL AND episode_id IS NOT NULL
            GROUP BY episode_id HAVING COUNT(*) > 1) d`, { transaction });
      if (dupes[0].n > 0) {
        throw new Error(`[migration 20261110230000] refused, nothing changed: ${dupes[0].n} episode(s) are in more than one live season slot. `
          + 'Repair them first (Diagnostics: db-season-integrity).');
      }

      if (!(await columnExists(sequelize, transaction))) {
        await sequelize.query(`ALTER TABLE ${TABLE} ADD COLUMN release_position INTEGER`, { transaction });
      }
      if (!(await constraintExists(sequelize, RANGE, transaction))) {
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${RANGE}
             CHECK (release_position IS NULL OR release_position BETWEEN 1 AND 24)`, { transaction });
      }
      if (!(await constraintExists(sequelize, POSITION, transaction))) {
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${POSITION}
             EXCLUDE USING btree (arc_id WITH =, (COALESCE(release_position, slot_number)) WITH =)
             WHERE (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED`, { transaction });
      }
      if (!(await constraintExists(sequelize, OCCUPANCY, transaction))) {
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${OCCUPANCY}
             EXCLUDE USING btree (episode_id WITH =)
             WHERE (deleted_at IS NULL AND episode_id IS NOT NULL) DEFERRABLE INITIALLY DEFERRED`, { transaction });
      }

      const [rows] = await sequelize.query(
        `SELECT COUNT(*)::int AS slots, COUNT(release_position)::int AS positioned FROM ${TABLE}`, { transaction });
      console.log(`[migration 20261110230000] release_position and its three rules are on season_slots; `
        + `${rows[0].slots} slot row(s), ${rows[0].positioned} with a release position`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (await columnExists(sequelize, transaction)) {
        const [rows] = await sequelize.query(
          `SELECT COUNT(*)::int AS n FROM ${TABLE} WHERE release_position IS NOT NULL`, { transaction });
        if (rows[0].n > 0) {
          throw new Error(`[migration 20261110230000] down refused, nothing changed: ${rows[0].n} slot row(s) have a release position. `
            + 'Dropping the column would move their release dates. Clear the positions first.');
        }
      }
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${OCCUPANCY}`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${POSITION}`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${RANGE}`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS release_position`, { transaction });
    });
  },
};
