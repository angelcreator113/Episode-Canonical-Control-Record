'use strict';

/**
 * Layout Editor drafts (Task #1909). Evoni's ruling (2026-09-25), option (a):
 * "a migration adding the four columns. 'Save draft' is a feature people use
 * and expect to persist; storing it inside another JSONB column would be a
 * second home, and retiring it removes something that should work."
 *
 * POST /api/v1/compositions/:id/save-draft writes the four draft columns;
 * /apply-draft merges draft_overrides into layout_overrides and clears the
 * draft. None of the five is in canon (docs/audit/
 * EvidenceNote_Canon_Schema_Capture_2026-09-17.txt lists thumbnail_compositions
 * without them), so layout_overrides is added here as well.
 *
 * Types follow how the routes use each column:
 *   draft_overrides      JSONB    { roles: { <role>: { x, y, scale, … } } }
 *   draft_updated_at     DATE     new Date() on save, null on apply
 *   draft_updated_by     STRING   req.user.id (a Cognito sub) or 'system';
 *                                 varchar(255), as created_by
 *   has_unsaved_changes  BOOLEAN  NOT NULL DEFAULT false; true on save,
 *                                 false on apply
 *   layout_overrides     JSONB    the applied overrides, same shape
 *
 * Additive and idempotent: each column is added only when describeTable
 * does not already show it. thumbnail_compositions already has deleted_at
 * (20260127000001-add-thumbnail-compositions-deleted-at.js).
 *
 * Deploy order: run this migration, then deploy the code. The code is safe
 * in either order (src/services/compositionDraftColumns.js): until these
 * columns exist, save-draft and apply-draft answer 501 and the model does
 * not name them in any query.
 */
const COLUMNS = (Sequelize) => ({
  draft_overrides: {
    type: Sequelize.JSONB,
    allowNull: true,
    comment: 'Layout Editor draft, not yet applied (Task #1909)',
  },
  draft_updated_at: {
    type: Sequelize.DATE,
    allowNull: true,
    comment: 'When the draft was last saved (Task #1909)',
  },
  draft_updated_by: {
    type: Sequelize.STRING(255),
    allowNull: true,
    comment: 'Who last saved the draft (Task #1909)',
  },
  has_unsaved_changes: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'A draft is saved but not applied (Task #1909)',
  },
  layout_overrides: {
    type: Sequelize.JSONB,
    allowNull: true,
    comment: 'Applied Layout Editor overrides (Task #1909)',
  },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.describeTable('thumbnail_compositions');
    const cols = COLUMNS(Sequelize);
    if (!existing.draft_overrides) {
      await queryInterface.addColumn('thumbnail_compositions', 'draft_overrides', cols.draft_overrides);
    }
    if (!existing.draft_updated_at) {
      await queryInterface.addColumn('thumbnail_compositions', 'draft_updated_at', cols.draft_updated_at);
    }
    if (!existing.draft_updated_by) {
      await queryInterface.addColumn('thumbnail_compositions', 'draft_updated_by', cols.draft_updated_by);
    }
    if (!existing.has_unsaved_changes) {
      await queryInterface.addColumn('thumbnail_compositions', 'has_unsaved_changes', cols.has_unsaved_changes);
    }
    if (!existing.layout_overrides) {
      await queryInterface.addColumn('thumbnail_compositions', 'layout_overrides', cols.layout_overrides);
    }
  },

  async down(queryInterface) {
    const existing = await queryInterface.describeTable('thumbnail_compositions');
    for (const col of ['layout_overrides', 'has_unsaved_changes', 'draft_updated_by', 'draft_updated_at', 'draft_overrides']) {
      if (existing[col]) await queryInterface.removeColumn('thumbnail_compositions', col);
    }
  },
};
