'use strict';

/**
 * Camera-roll photos: one paid image request at a time, and a paid outcome
 * that is not known is never made again on its own (#3714 follow-up;
 * Evoni approved the five columns and the two statuses, 2026-11-07;
 * services/cameraRoll make, resolve).
 *
 *   status gains 'making' (claimed for a Make: one at a time) and
 *       'uncertain' (a paid image request was sent and the run then failed,
 *       so the photo may already be made and charged).
 *   make_claim_token UUID NULL        the claim a Make holds; every write of
 *       its result matches it, so an older run cannot overwrite a newer one
 *   make_claimed_at TIMESTAMPTZ NULL  when it was claimed (a stale claim is
 *       reconciled, never re-run)
 *   make_previous_status VARCHAR(12) NULL  the status to restore when the
 *       attempt provably sent nothing ('uncertain' when an authorized
 *       attempt was claimed from it)
 *   make_attempted_at TIMESTAMPTZ NULL     committed before the paid request
 *       is sent; set means the request may have been accepted
 *   make_resolution JSONB NULL        Evoni's resolution of an uncertain
 *       result: acknowledged / one-time authorization / abandoned, with a
 *       history of who did what and when
 *
 * All new columns are nullable with no backfill: existing photos are
 * unchanged. Down refuses while any photo, soft-deleted ones included, is
 * 'making' or 'uncertain'; otherwise it restores the original constraint
 * and drops the columns.
 */
const TABLE = 'camera_roll_moments';
const OLD_STATUSES = "('proposed', 'kept', 'dropped', 'made', 'failed')";
const NEW_STATUSES = "('proposed', 'kept', 'dropped', 'made', 'failed', 'making', 'uncertain')";

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction });
      await q(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS camera_roll_moments_status`);
      await q(`ALTER TABLE ${TABLE} ADD CONSTRAINT camera_roll_moments_status CHECK (status IN ${NEW_STATUSES})`);
      await q(`ALTER TABLE ${TABLE}
        ADD COLUMN IF NOT EXISTS make_claim_token UUID NULL,
        ADD COLUMN IF NOT EXISTS make_claimed_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS make_previous_status VARCHAR(12) NULL,
        ADD COLUMN IF NOT EXISTS make_attempted_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS make_resolution JSONB NULL`);
      await q(`ALTER TABLE ${TABLE} ADD CONSTRAINT camera_roll_moments_make_previous_status
        CHECK (make_previous_status IS NULL OR make_previous_status IN ('proposed', 'kept', 'failed', 'uncertain'))`);
      await q(`ALTER TABLE ${TABLE} ADD CONSTRAINT camera_roll_moments_making_claim
        CHECK (status <> 'making' OR (make_claim_token IS NOT NULL AND make_claimed_at IS NOT NULL AND make_previous_status IS NOT NULL))`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      // Soft-deleted rows count: deleted_at is not filtered.
      const [[row]] = await sequelize.query(
        `SELECT count(*)::int AS n FROM ${TABLE} WHERE status IN ('making', 'uncertain')`, { transaction });
      if (row.n > 0) {
        throw new Error(`Refusing to remove the 'making' and 'uncertain' statuses: ${row.n} camera-roll photo(s), soft-deleted ones included, still use them. Resolve them first (services/cameraRoll resolve).`);
      }
      const q = (sql) => sequelize.query(sql, { transaction });
      await q(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS camera_roll_moments_making_claim`);
      await q(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS camera_roll_moments_make_previous_status`);
      await q(`ALTER TABLE ${TABLE}
        DROP COLUMN IF EXISTS make_claim_token,
        DROP COLUMN IF EXISTS make_claimed_at,
        DROP COLUMN IF EXISTS make_previous_status,
        DROP COLUMN IF EXISTS make_attempted_at,
        DROP COLUMN IF EXISTS make_resolution`);
      await q(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS camera_roll_moments_status`);
      await q(`ALTER TABLE ${TABLE} ADD CONSTRAINT camera_roll_moments_status CHECK (status IN ${OLD_STATUSES})`);
    });
  },
};
