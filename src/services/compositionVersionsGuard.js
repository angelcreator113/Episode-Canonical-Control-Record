'use strict';

/**
 * composition_versions guard (Task #1910)
 *
 * VersioningService reads and writes the `composition_versions` table, and
 * FilterService counted rows in it. That table is not in canon: it is absent
 * from the 2026-09-17 canon capture
 * (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt), from the FD31
 * prod dump, and from every migration under src/migrations/. The only file that
 * ever created it, migrations/20260105000000-add-composition-versioning.js
 * (root node-pg-migrate tree, never run by any script), was deleted in 4698bf925.
 *
 * Evoni has not yet ruled between (a) creating the table with a migration and
 * (b) retiring it in favour of thumbnail_compositions.version_history. Until she
 * does, every path that needs the table refuses with 501 instead of failing with
 * a 500 on a missing relation.
 *
 * This is a static flag, not a per-request schema query. To remove the guard
 * once the ruling is implemented: delete this file, the assertCompositionVersionsInCanon()
 * calls in VersioningService, the flag branch in FilterService.searchCompositions,
 * and versionRouteError() in src/routes/compositions.js.
 */
const COMPOSITION_VERSIONS_IN_CANON = false;

const UNDECIDED_CODE = 'COMPOSITION_VERSIONS_UNDECIDED';

const UNDECIDED_MESSAGE =
  'Composition version history is not available: the composition_versions table ' +
  'is not in the canon schema, and whether to create it or retire it is undecided (#1910).';

function assertCompositionVersionsInCanon() {
  if (COMPOSITION_VERSIONS_IN_CANON) return;
  const error = new Error(UNDECIDED_MESSAGE);
  error.status = 501;
  error.code = UNDECIDED_CODE;
  throw error;
}

module.exports = {
  COMPOSITION_VERSIONS_IN_CANON,
  UNDECIDED_CODE,
  UNDECIDED_MESSAGE,
  assertCompositionVersionsInCanon,
};
