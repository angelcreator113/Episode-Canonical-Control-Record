'use strict';

/**
 * One paid generation at a time for a scene set's base or an angle (audit,
 * 2026-10-15: a double click, a cascade over an angle already running, or a
 * queued refine pass started and billed a second run).
 *
 * A row is claimed by marking it generating in one statement, unless it is
 * generating already. A claim older than GENERATION_STALE_MINUTES is a run
 * that died and can be taken again. Every reader of a set's or angle's
 * generating state uses this one window: a 10-minute sweep beside a
 * 15-minute claim let a second base run start while the first was live.
 */
const GENERATION_STALE_MINUTES = 15;
const STALE_MS = GENERATION_STALE_MINUTES * 60 * 1000;

const CLAIM_TABLES = Object.freeze({ set: 'scene_sets', angle: 'scene_angles' });

/** true when the row was claimed; false when a live run holds it. */
async function claimRow(sequelize, kind, id, { transaction } = {}) {
  const table = CLAIM_TABLES[kind];
  if (!table) throw new Error(`Unknown claim kind: ${kind}`);
  const [rows] = await sequelize.query(
    `UPDATE ${table} SET generation_status = 'generating', updated_at = NOW()
      WHERE id = :id
        AND (generation_status IS DISTINCT FROM 'generating'
             OR updated_at < NOW() - make_interval(mins => :stale))
      RETURNING id`,
    { replacements: { id, stale: GENERATION_STALE_MINUTES }, transaction });
  return rows.length > 0;
}

/** True when a row (a model instance or a plain row) is generating within the window. */
function isLiveGeneration(row) {
  if (!row || row.generation_status !== 'generating') return false;
  const at = row.updatedAt || row.updated_at;
  return !at || Date.now() - new Date(at).getTime() < STALE_MS;
}

module.exports = {
  GENERATION_STALE_MINUTES,
  STALE_MS,
  claimRow,
  isLiveGeneration,
};
