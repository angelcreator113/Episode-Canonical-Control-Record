/**
 * worldEventSafeDelete — the one way a route removes world_events rows in
 * bulk (2026-11-04).
 *
 * An event is removable only when it was never used in an episode (status
 * not used/filmed, no used_in_episode_id, times_used 0 or null) and no live
 * row of EVENT_LINK_TABLES points at it. Removal is a soft delete
 * (deleted_at = NOW()); every other event is kept and reported with why.
 *
 * Callers: eventGeneratorRoute (replace_existing) and
 * worldEvents/episodeBatch (bulk-delete).
 */

'use strict';

// Tables whose event_id points at a world_events row.
const EVENT_LINK_TABLES = [
  'season_slots', 'season_specials', 'opportunities', 'episode_briefs',
  'feed_posts', 'event_deliverables', 'event_costs',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The link tables that exist with an event_id column, and whether each has
// deleted_at (a soft-deleted link row does not hold the event).
async function presentLinkTables(sequelize, transaction) {
  const rows = await sequelize.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND column_name IN ('event_id', 'deleted_at')
        AND table_name IN (:tables)`,
    { replacements: { tables: EVENT_LINK_TABLES }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  const has = (t, c) => rows.some(r => r.table_name === t && r.column_name === c);
  return EVENT_LINK_TABLES
    .filter(t => has(t, 'event_id'))
    .map(t => ({ table: t, paranoid: has(t, 'deleted_at') }));
}

/**
 * Soft-deletes the show's live events that are unused and unlinked.
 *
 * @param sequelize
 * @param {object} opts
 * @param {string} opts.showId
 * @param {string[]} [opts.ids]     only these events (others of the show are untouched)
 * @param {string} [opts.status]    only events with this status (e.g. 'draft')
 * @param opts.transaction          required: the caller's transaction
 * @returns {{ softDeleted: {id,name}[], kept: {id,name,status,used,linked_by}[], notFound: string[] }}
 */
async function softDeleteUnusedUnlinkedEvents(sequelize, { showId, ids = null, status = null, transaction }) {
  if (!transaction) throw new Error('softDeleteUnusedUnlinkedEvents needs a transaction');

  let notFound = [];
  let wantedIds = null;
  if (ids) {
    wantedIds = [...new Set(ids.map(String))];
    notFound = wantedIds.filter(id => !UUID_RE.test(id));
    wantedIds = wantedIds.filter(id => UUID_RE.test(id));
    if (wantedIds.length === 0) return { softDeleted: [], kept: [], notFound };
  }

  // Names come from the EVENT_LINK_TABLES constant, never from the request.
  const links = await presentLinkTables(sequelize, transaction);
  const linkedBy = links.length
    ? `ARRAY_REMOVE(ARRAY[${links.map(({ table, paranoid }) =>
      `CASE WHEN EXISTS (SELECT 1 FROM ${table} l WHERE l.event_id = we.id${paranoid ? ' AND l.deleted_at IS NULL' : ''}) THEN '${table}' END`).join(', ')}], NULL)`
    : 'ARRAY[]::text[]';

  const where = ['we.show_id = :showId', 'we.deleted_at IS NULL'];
  if (wantedIds) where.push('we.id IN (:ids)');
  if (status) where.push('we.status = :status');

  const rows = await sequelize.query(
    `SELECT we.id, we.name, we.status,
            (COALESCE(we.status, '') IN ('used', 'filmed')
              OR we.used_in_episode_id IS NOT NULL
              OR COALESCE(we.times_used, 0) > 0) AS used,
            ${linkedBy} AS linked_by
       FROM world_events we
      WHERE ${where.join(' AND ')}
      FOR UPDATE OF we`,
    { replacements: { showId, ids: wantedIds, status }, type: sequelize.QueryTypes.SELECT, transaction }
  );

  if (wantedIds) {
    const found = new Set(rows.map(r => r.id));
    notFound = notFound.concat(wantedIds.filter(id => !found.has(id)));
  }

  const softDeleted = [];
  const kept = [];
  for (const row of rows) {
    const linked = Array.isArray(row.linked_by) ? row.linked_by : [];
    if (row.used || linked.length > 0) {
      kept.push({ id: row.id, name: row.name, status: row.status, used: !!row.used, linked_by: linked });
    } else {
      softDeleted.push({ id: row.id, name: row.name });
    }
  }

  if (softDeleted.length > 0) {
    await sequelize.query(
      `UPDATE world_events SET deleted_at = NOW(), updated_at = NOW()
        WHERE id IN (:ids) AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { ids: softDeleted.map(e => e.id), showId }, transaction }
    );
  }
  return { softDeleted, kept, notFound };
}

module.exports = { EVENT_LINK_TABLES, softDeleteUnusedUnlinkedEvents };
