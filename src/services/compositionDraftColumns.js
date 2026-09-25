'use strict';

/**
 * compositionDraftColumns — can "Save draft" and "Apply draft" store what
 * they write? (Task #1909)
 *
 * POST /api/v1/compositions/:id/save-draft writes draft_overrides,
 * draft_updated_at, draft_updated_by and has_unsaved_changes on a loaded
 * ThumbnailComposition; /apply-draft reads draft_overrides back and writes
 * layout_overrides. None of the five was in canon (the 2026-09-17 capture,
 * docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt), so
 * Sequelize dropped every one of them and the route answered "Draft saved
 * successfully" anyway. Evoni's ruling (2026-09-25): add the columns with a
 * migration (20260925000000-add-draft-columns-to-thumbnail-compositions.js);
 * the routes answer 501 until it runs.
 *
 * The guard reads the live table with describeTable and answers true only
 * when all five columns are there (and the model declares them). A true
 * answer is memoised, so after the first success it costs nothing; while
 * the answer is false it is checked again on each save-draft / apply-draft
 * request. It never modifies the model.
 *
 * Deploy order (Evoni, 2026-09-25, option (b)): run the migration first,
 * then deploy the code. The model declares the five columns, so code
 * deployed before the migration would name them in every ThumbnailComposition
 * query; the process (migrations before deploys, and
 * scripts/check-pending-migrations.js) is the guard against that.
 */

const DRAFT_COLUMNS = Object.freeze([
  'draft_overrides',
  'draft_updated_at',
  'draft_updated_by',
  'has_unsaved_changes',
  'layout_overrides',
]);

// Models whose table has been seen with all five columns.
const READY = new WeakSet();

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * @param {typeof import('sequelize').Model} Model — ThumbnailComposition
 * @returns {Promise<boolean>} true when the model declares all five columns and the table has them
 */
async function draftColumnsReady(Model) {
  if (READY.has(Model)) return true;
  if (!DRAFT_COLUMNS.every((c) => has(Model.rawAttributes, c))) return false;

  const described = await Model.sequelize.getQueryInterface().describeTable(Model.getTableName());
  const ready = DRAFT_COLUMNS.every((c) => has(described || {}, c));
  if (ready) READY.add(Model);
  return ready;
}

const DRAFT_UNAVAILABLE = Object.freeze({
  status: 'ERROR',
  code: 'DRAFT_COLUMNS_MISSING',
  error:
    'Layout drafts cannot be stored yet: the database has no draft columns. ' +
    'Nothing was saved. (Task #1909: the columns arrive with a migration.)',
});

module.exports = { DRAFT_COLUMNS, DRAFT_UNAVAILABLE, draftColumnsReady };
