'use strict';

/**
 * registry_characters.world gets a creating migration (F-Reg-2 Fix Plan v1.1;
 * Task #2111).
 *
 * The RegistryCharacter model declares `world` (ENUM 'book-1', 'lalaverse',
 * 'series-2', nullable) and production has it, but no migration created the
 * enum type or the column. On a database built by the migration tree (CI, a
 * new dev box) every RegistryCharacter load failed with 'column "world" does
 * not exist'.
 *
 * Evoni's ruling (2026-09-27, recorded on Task #2101, quoted in
 * F-Reg-2_Fix_Plan_v1.1.md §1): "The registry_characters.world column, which
 * the model declares and production has but no migration creates, is homed to
 * F-Reg-2 and owed as a migration that adds it only where missing, matching
 * production exactly."
 *
 * The target is her production read of 2026-09-27 (v1.1 §2): column `world`,
 * data type USER-DEFINED, udt enum_registry_characters_world, nullable, no
 * default; the enum's labels, in order, book-1, lalaverse, series-2.
 *
 * In one transaction:
 *   - the type is created only if pg_type has no enum_registry_characters_world.
 *     If the type exists with other labels (or another order), the migration
 *     stops with an error naming the difference; it never alters the type.
 *   - the column is added only if registry_characters has no `world` column.
 * Where both exist (production), nothing changes. No data is written.
 *
 * down does nothing: dropping the column or the type would destroy
 * production's values, and this migration cannot tell what it created from
 * what was already there.
 */
const TYPE = 'enum_registry_characters_world';
const LABELS = ['book-1', 'lalaverse', 'series-2'];

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const rows = await sequelize.query(
        `SELECT e.enumlabel
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           LEFT JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE n.nspname = 'public' AND t.typname = :type
          ORDER BY e.enumsortorder`,
        { replacements: { type: TYPE }, transaction, type: sequelize.QueryTypes.SELECT }
      );

      if (rows.length === 0) {
        const list = LABELS.map(l => `'${l}'`).join(', ');
        await sequelize.query(`CREATE TYPE public.${TYPE} AS ENUM (${list})`, { transaction });
        console.log(`[migration 20260927210000] created type ${TYPE} (${LABELS.join(', ')}).`);
      } else {
        const found = rows.map(r => r.enumlabel).filter(l => l !== null);
        if (found.join('\u0000') !== LABELS.join('\u0000')) {
          throw new Error(
            `[migration 20260927210000] type ${TYPE} exists with labels [${found.join(', ')}], ` +
            `expected [${LABELS.join(', ')}] in that order; not altering it (F-Reg-2 Fix Plan v1.1).`
          );
        }
        console.log(`[migration 20260927210000] type ${TYPE} already exists with the expected labels; unchanged.`);
      }

      const [column] = await sequelize.query(
        `SELECT 1 AS present FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'registry_characters' AND column_name = 'world'`,
        { transaction, type: sequelize.QueryTypes.SELECT }
      );
      if (!column) {
        await sequelize.query(`ALTER TABLE public.registry_characters ADD COLUMN world public.${TYPE}`, { transaction });
        console.log('[migration 20260927210000] added registry_characters.world.');
      } else {
        console.log('[migration 20260927210000] registry_characters.world already exists; unchanged.');
      }
    });
  },

  async down() {
    // Deliberately nothing. Dropping registry_characters.world or its type would
    // destroy production's values, and up() never changed either where it
    // already existed, so there is nothing of its own to undo there.
    console.log('[migration 20260927210000] down: no-op by design (F-Reg-2 Fix Plan v1.1).');
  },
};
