'use strict';

/**
 * compositionDraftColumns — can "Save draft" and "Apply draft" store what
 * they write? (Task #1909)
 *
 * POST /api/v1/compositions/:id/save-draft writes draft_overrides,
 * draft_updated_at, draft_updated_by and has_unsaved_changes on a loaded
 * ThumbnailComposition; /apply-draft reads draft_overrides back and writes
 * layout_overrides. None of the five was in canon (the 2026-09-17 capture,
 * docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt) or on the
 * model, so Sequelize dropped every one of them and the route answered
 * "Draft saved successfully" anyway. Evoni's ruling (2026-09-25): add the
 * columns with a migration; the routes answer 501 until the migration runs.
 *
 * How the routes know the columns exist — two conditions, both required:
 *
 *   1. The model declares all five (rawAttributes). Without the declaration
 *      Sequelize drops the values whatever the table has, so the answer is
 *      "no" and no query is made.
 *   2. The live table has all five. Checked with describeTable, but only
 *      until the first time the answer is "yes"; from then on it is a
 *      memoised flag and costs nothing (columns are not dropped under a
 *      running process). While the answer is "no" it is re-checked on each
 *      save-draft / apply-draft request, so the routes start working as soon
 *      as the migration has run, with no restart.
 *
 * Checking the declaration alone is not enough, because the same change that
 * adds the migration declares the columns: if the code were deployed before
 * the migration ran, a declaration-only guard would already let the write
 * through. Condition 2 keeps the guard shut in that order.
 *
 * The other half of deploy-order safety: a model that declares a column the
 * table lacks names it in every SELECT and INSERT, so every composition read
 * would fail with "column … does not exist". syncDraftColumns therefore
 * detaches (Model.removeAttribute-style) each declared draft column the table
 * lacks, and re-attaches it once the table has it. src/server.js calls it
 * once at boot, after the database connection is confirmed and before the
 * server listens, so no composition request runs before the model matches
 * the table.
 */

const DRAFT_COLUMNS = Object.freeze([
  'draft_overrides',
  'draft_updated_at',
  'draft_updated_by',
  'has_unsaved_changes',
  'layout_overrides',
]);

// Model -> { ready, detached: { column: attributeDefinition } }
const STATE = new WeakMap();

function stateOf(Model) {
  let s = STATE.get(Model);
  if (!s) {
    s = { ready: false, detached: {} };
    STATE.set(Model, s);
  }
  return s;
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Bring the model's draft attributes in line with the live table, and report
 * whether save-draft / apply-draft can store what they write.
 *
 * @param {typeof import('sequelize').Model} Model — ThumbnailComposition
 * @returns {Promise<boolean>} true when all five columns are declared and in the table
 */
async function syncDraftColumns(Model) {
  const s = stateOf(Model);
  if (s.ready) return true;

  const declared = DRAFT_COLUMNS.every((c) => has(Model.rawAttributes, c) || has(s.detached, c));
  if (!declared) return false;

  const described = await Model.sequelize.getQueryInterface().describeTable(Model.getTableName());
  const live = new Set(Object.keys(described || {}));

  let changed = false;
  for (const c of DRAFT_COLUMNS) {
    if (live.has(c) && has(s.detached, c)) {
      Model.rawAttributes[c] = s.detached[c];
      delete s.detached[c];
      changed = true;
    } else if (!live.has(c) && has(Model.rawAttributes, c)) {
      s.detached[c] = Model.rawAttributes[c];
      delete Model.rawAttributes[c];
      changed = true;
    }
  }
  if (changed) Model.refreshAttributes();

  s.ready = DRAFT_COLUMNS.every((c) => live.has(c) && has(Model.rawAttributes, c));
  return s.ready;
}

const DRAFT_UNAVAILABLE = Object.freeze({
  status: 'ERROR',
  code: 'DRAFT_COLUMNS_MISSING',
  error:
    'Layout drafts cannot be stored yet: the database has no draft columns. ' +
    'Nothing was saved. (Task #1909: the columns arrive with a migration.)',
});

module.exports = { DRAFT_COLUMNS, DRAFT_UNAVAILABLE, syncDraftColumns };
