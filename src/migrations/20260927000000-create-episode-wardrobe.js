'use strict';

/**
 * episode_wardrobe gets a creating migration (F-Ward-1 Fix Plan v1.0, O1;
 * Task #2087; Decision #59).
 *
 * No live migration created episode_wardrobe: production has it, a fresh
 * database (CI, a new dev box) did not. 20260925000001 and 20260926000000
 * alter it only where it exists and log and skip on a fresh database, so they
 * leave nothing behind there. This one runs after them and builds the table.
 *
 * Evoni's ruling (2026-09-27, F-Ward-1_Fix_Plan_v1.0.md §1): "The migration
 * recreates production's current episode_wardrobe schema exactly (16 columns,
 * 5 constraints, 7 indexes, as I read them on 2026-09-27) and changes nothing
 * where the table already exists."
 *
 * The target is her production read, quoted in the plan's §2.1 (columns and
 * constraints) and §2.2 (indexes), with varchar lengths from her read of the
 * same day (scene 255, approval_status 50, approved_by 255). Columns are in
 * production's order, with production's types, nullability and defaults;
 * constraints and indexes carry production's names and definitions.
 *
 * Where the table exists (production, any database that has it), this
 * changes nothing: it logs and returns before any DDL. Where it does not, it
 * creates the table, then each constraint and index, all in one transaction;
 * each constraint and index is also skipped if one of that name is already
 * there, so a re-run can never duplicate one.
 *
 * down does nothing: dropping episode_wardrobe would destroy production's
 * rows, and this migration cannot tell a table it created from one that was
 * already there.
 */
const TABLE = 'episode_wardrobe';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS public.episode_wardrobe (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    episode_id uuid NOT NULL,
    wardrobe_id uuid NOT NULL,
    scene character varying(255),
    worn_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    scene_id uuid,
    is_episode_favorite boolean NOT NULL DEFAULT false,
    times_worn integer NOT NULL DEFAULT 1,
    approval_status character varying(50) DEFAULT 'pending'::character varying,
    approved_by character varying(255),
    approved_at timestamp with time zone,
    rejection_reason text,
    deleted_at timestamp with time zone
  )`;

// Production's five constraints, by name and definition (plan §2.1).
const CONSTRAINTS = [
  ['episode_wardrobe_pkey', 'PRIMARY KEY (id)'],
  ['unique_episode_wardrobe', 'UNIQUE (episode_id, wardrobe_id)'],
  ['episode_wardrobe_episode_id_fkey', 'FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE'],
  ['episode_wardrobe_wardrobe_id_fkey', 'FOREIGN KEY (wardrobe_id) REFERENCES wardrobe(id) ON DELETE CASCADE'],
  ['episode_wardrobe_scene_id_fkey', 'FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL'],
];

// Production's seven indexes (plan §2.2). episode_wardrobe_pkey and
// unique_episode_wardrobe are the indexes behind the first two constraints;
// the other five are created here.
const INDEXES = [
  ['episode_wardrobe_episode_id', 'CREATE INDEX IF NOT EXISTS episode_wardrobe_episode_id ON public.episode_wardrobe USING btree (episode_id)'],
  ['episode_wardrobe_wardrobe_id', 'CREATE INDEX IF NOT EXISTS episode_wardrobe_wardrobe_id ON public.episode_wardrobe USING btree (wardrobe_id)'],
  ['idx_episode_wardrobe_favorites', 'CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_favorites ON public.episode_wardrobe USING btree (is_episode_favorite) WHERE (is_episode_favorite = true)'],
  ['idx_episode_wardrobe_scene_id', 'CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_scene_id ON public.episode_wardrobe USING btree (scene_id)'],
  ['idx_episode_wardrobe_worn_at', 'CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_worn_at ON public.episode_wardrobe USING btree (worn_at)'],
];

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await queryInterface.tableExists(TABLE, { transaction })) {
        console.log(`[migration 20260927000000] ${TABLE} already exists; changing nothing (F-Ward-1 Fix Plan v1.0 §1).`);
        return;
      }

      await sequelize.query(CREATE_TABLE, { transaction });

      for (const [name, def] of CONSTRAINTS) {
        const [found] = await sequelize.query(
          `SELECT 1 FROM pg_constraint WHERE conrelid = 'public.${TABLE}'::regclass AND conname = :name`,
          { replacements: { name }, transaction }
        );
        if (found.length === 0) {
          await sequelize.query(`ALTER TABLE public.${TABLE} ADD CONSTRAINT ${name} ${def}`, { transaction });
        }
      }

      for (const [, sql] of INDEXES) {
        await sequelize.query(sql, { transaction });
      }

      console.log(`[migration 20260927000000] created ${TABLE}: 16 columns, 5 constraints, 7 indexes.`);
    });
  },

  async down() {
    // Deliberately nothing. Dropping episode_wardrobe would destroy production's
    // rows, and up() never touched a table that already existed, so there is no
    // change of its own on such a database to undo.
    console.log('[migration 20260927000000] down: no-op by design (F-Ward-1 Fix Plan v1.0 §1).');
  },
};
