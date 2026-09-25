'use strict';

/**
 * episode_wardrobe gets its approval columns (Task #1924).
 *
 * Production read, ATTESTED 2026-09-25 (Evoni): episode_wardrobe has exactly
 * 11 columns — id, episode_id, wardrobe_id, scene, scene_id, notes, worn_at,
 * times_worn, is_episode_favorite, created_at, updated_at (the canon capture,
 * docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt, agrees). The
 * EpisodeWardrobe model declares approval_status, approved_by, approved_at
 * and rejection_reason, so every model query failed, and no live migration
 * creates the table.
 *
 * Evoni's ruling (2026-09-25): "Add the four columns by migration, same
 * shape as #1922 — approval is part of the design, so the table should match
 * the model rather than the model losing the feature." On Decide:
 *   1. deleted_at, option (a): add it and make the model paranoid.
 *   2. approval_status for existing rows: 'approved' — "They were deliberate
 *      picks made through the styling game, which is the intended path."
 *
 * Types come from src/models/EpisodeWardrobe.js:
 *   approval_status   STRING(50)   NULL, DEFAULT 'pending'
 *   approved_by       STRING(255)  NULL
 *   approved_at       DATE         NULL
 *   rejection_reason  TEXT         NULL
 *   deleted_at        DATE         NULL (paranoid; the model maps deletedAt)
 *
 * Existing rows: approval_status is added with the model's default,
 * 'pending', and then this migration runs
 *   UPDATE episode_wardrobe SET approval_status = 'approved'
 *   WHERE approval_status IS NULL OR approval_status = 'pending'
 * only when it has just added the column in this run, so every row that
 * existed before the column did is 'approved' and a re-run on a table that
 * already has the column changes no row. All of it runs in one
 * transaction. (Postgres fills a column added with
 * a DEFAULT on existing rows, so they read 'pending' until the UPDATE.)
 * New styling-game picks set 'approved' themselves (src/routes/wardrobe.js,
 * POST /wardrobe/select).
 *
 * No CREATE TABLE: the table exists in canon. Additive and idempotent: each
 * column is added only when describeTable does not already show it; down
 * removes those that are there.
 *
 * Deploy order: run this migration, then deploy the code. The model names
 * all five columns in every EpisodeWardrobe query (deleted_at in every
 * paranoid WHERE), and the raw reads of episode_wardrobe now filter
 * ew.deleted_at IS NULL, so code deployed first breaks reads that work today.
 */
const TABLE = 'episode_wardrobe';

const COLUMNS = (Sequelize) => ({
  approval_status: {
    type: Sequelize.STRING(50),
    allowNull: true,
    defaultValue: 'pending',
    comment: 'Approval status: pending, approved, rejected (Task #1924)',
  },
  approved_by: {
    type: Sequelize.STRING(255),
    allowNull: true,
    comment: 'User who approved this item (Task #1924)',
  },
  approved_at: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'When this item was approved (Task #1924)',
  },
  rejection_reason: {
    type: Sequelize.TEXT,
    allowNull: true,
    comment: 'Reason for rejection if applicable (Task #1924)',
  },
  deleted_at: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'Soft delete: a removed wardrobe row keeps its record (Task #1924)',
  },
});

const ORDER = ['approval_status', 'approved_by', 'approved_at', 'rejection_reason', 'deleted_at'];

module.exports = {
  // One transaction (Postgres DDL is transactional): if the backfill fails,
  // the columns are not left behind without it, and a re-run starts clean.
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existing = await queryInterface.describeTable(TABLE, { transaction });
      const cols = COLUMNS(Sequelize);
      const addedApprovalStatus = !existing.approval_status;
      if (!existing.approval_status) {
        await queryInterface.addColumn(TABLE, 'approval_status', cols.approval_status, { transaction });
      }
      if (!existing.approved_by) {
        await queryInterface.addColumn(TABLE, 'approved_by', cols.approved_by, { transaction });
      }
      if (!existing.approved_at) {
        await queryInterface.addColumn(TABLE, 'approved_at', cols.approved_at, { transaction });
      }
      if (!existing.rejection_reason) {
        await queryInterface.addColumn(TABLE, 'rejection_reason', cols.rejection_reason, { transaction });
      }
      if (!existing.deleted_at) {
        await queryInterface.addColumn(TABLE, 'deleted_at', cols.deleted_at, { transaction });
      }
      // Evoni's ruling 2: the rows that existed before approval did are approved.
      if (addedApprovalStatus) {
        await queryInterface.sequelize.query(
          `UPDATE episode_wardrobe SET approval_status = 'approved'
           WHERE approval_status IS NULL OR approval_status = 'pending'`,
          { transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existing = await queryInterface.describeTable(TABLE, { transaction });
      for (const col of [...ORDER].reverse()) {
        if (existing[col]) await queryInterface.removeColumn(TABLE, col, { transaction });
      }
    });
  },
};
