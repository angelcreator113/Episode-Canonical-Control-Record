'use strict';

/**
 * The world snapshot a show's script writers read (Evoni, 2026-10-07: "by
 * universe id"; wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md,
 * fix-list item 17).
 *
 * world_state_snapshots has no show_id, so the writers' old
 * `WHERE show_id = :showId` failed on every call and they wrote with no
 * world state. A snapshot belongs to a universe (universe_id), or to the
 * world when it has none: every snapshot saved by hand before saving
 * stamped the show's universe. The writers read the newest snapshot of
 * the show's universe or of none, never a 'temperature_update' reading
 * (worldTemperatureService), which carries a temperature and no world facts.
 */

const TEMPERATURE_LABEL = 'temperature_update';

/** The newest snapshot for a show, or null. Never throws. */
async function latestWorldSnapshotForShow(sequelize, showId) {
  try {
    const [rows] = await sequelize.query(
      `SELECT wss.* FROM world_state_snapshots wss
       WHERE wss.deleted_at IS NULL
         AND wss.snapshot_label <> :temperature
         AND (wss.universe_id IS NULL
              OR wss.universe_id = (SELECT s.universe_id FROM shows s WHERE s.id = :showId))
       ORDER BY wss.created_at DESC
       LIMIT 1`,
      { replacements: { showId: showId || null, temperature: TEMPERATURE_LABEL } }
    );
    return rows?.[0] || null;
  } catch (err) {
    console.error('[worldSnapshotForShow] the world snapshot could not be read:', err?.message);
    return null;
  }
}

/** The show's universe_id, or null (no show, no universe, or a failed read). */
async function universeIdForShow(sequelize, showId) {
  if (!showId) return null;
  try {
    const [rows] = await sequelize.query(
      'SELECT universe_id FROM shows WHERE id = :showId AND deleted_at IS NULL',
      { replacements: { showId } }
    );
    return rows?.[0]?.universe_id || null;
  } catch (err) {
    console.error('[worldSnapshotForShow] the show\'s universe could not be read:', err?.message);
    return null;
  }
}

module.exports = { latestWorldSnapshotForShow, universeIdForShow, TEMPERATURE_LABEL };
