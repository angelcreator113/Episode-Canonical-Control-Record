/**
 * worldEventSafeDelete — the one way a route removes world_events rows in
 * bulk (2026-11-04).
 *
 * An event is removable only when it was never used in an episode (status
 * not used/filmed, no used_in_episode_id, times_used 0 or null) and nothing
 * live links to it:
 *   - no live row in any discovered link column (discoverEventLinkColumns:
 *     every foreign key onto world_events(id), plus every column named
 *     event_id or world_event_id, minus NON_WORLD_EVENT_COLUMNS);
 *   - no live child event (world_events.parent_event_id) — 'child_events';
 *   - no live opportunity it was made for (world_events.opportunity_id) —
 *     'opportunity'.
 * Removal is a soft delete (deleted_at = NOW()); every other event is kept
 * and reported with why (linked_by).
 *
 * Callers: eventGeneratorRoute (replace_existing) and
 * worldEvents/episodeBatch (bulk-delete).
 */

'use strict';

// Columns named event_id that point at something other than world_events.
// calendar_event_attendees / calendar_event_ripples reference the novel's
// story calendar (story_calendar_events), per 20260312200000-story-calendar.js.
const NON_WORLD_EVENT_COLUMNS = new Set([
  'calendar_event_attendees.event_id',
  'calendar_event_ripples.event_id',
]);

// Column names treated as a link to world_events even without a foreign key
// (most link tables carry a bare uuid). Fail closed: a new table with one of
// these columns holds its events until it is added to the exclusions above.
const EVENT_LINK_COLUMN_NAMES = ['event_id', 'world_event_id'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Identifiers come only from the catalog; still quoted, never interpolated raw.
const ident = (name) => `"${String(name).replace(/"/g, '""')}"`;
const literal = (text) => `'${String(text).replace(/'/g, "''")}'`;

/**
 * Every column in the current schema that links a row to world_events(id):
 * single-column foreign keys onto world_events, union columns named event_id
 * / world_event_id, minus NON_WORLD_EVENT_COLUMNS and world_events itself
 * (its own parent_event_id is checked as 'child_events').
 *
 * @returns {{table, column, isUuid, paranoid, label}[]} sorted by table, column
 */
async function discoverEventLinkColumns(sequelize, transaction) {
  const rows = await sequelize.query(
    `WITH fk AS (
       SELECT cl.relname::text AS table_name, a.attname::text AS column_name
         FROM pg_constraint c
         JOIN pg_class cl ON cl.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = cl.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f'
          AND c.confrelid = to_regclass('world_events')
          AND n.nspname = current_schema()
          AND array_length(c.conkey, 1) = 1
     ), named AS (
       SELECT table_name::text, column_name::text
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND column_name IN (:names)
     ), links AS (
       SELECT * FROM fk UNION SELECT * FROM named
     )
     SELECT l.table_name, l.column_name,
            (col.data_type = 'uuid') AS is_uuid,
            EXISTS (SELECT 1 FROM information_schema.columns d
                     WHERE d.table_schema = current_schema()
                       AND d.table_name = l.table_name AND d.column_name = 'deleted_at') AS paranoid
       FROM links l
       JOIN information_schema.columns col
         ON col.table_schema = current_schema()
        AND col.table_name = l.table_name AND col.column_name = l.column_name
       JOIN information_schema.tables t
         ON t.table_schema = current_schema() AND t.table_name = l.table_name
        AND t.table_type = 'BASE TABLE'
      WHERE l.table_name <> 'world_events'
      ORDER BY l.table_name, l.column_name`,
    { replacements: { names: EVENT_LINK_COLUMN_NAMES }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  return rows
    .filter(r => !NON_WORLD_EVENT_COLUMNS.has(`${r.table_name}.${r.column_name}`))
    .map(r => ({
      table: r.table_name,
      column: r.column_name,
      isUuid: !!r.is_uuid,
      paranoid: !!r.paranoid,
      label: r.column_name === 'event_id' ? r.table_name : `${r.table_name}.${r.column_name}`,
    }));
}

// The self-links on world_events (parent_event_id, opportunity_id) present in
// this schema, and whether opportunities is soft-deletable.
async function selfLinkShape(sequelize, transaction) {
  const rows = await sequelize.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND ((table_name = 'world_events' AND column_name IN ('parent_event_id', 'opportunity_id'))
          OR (table_name = 'opportunities' AND column_name IN ('id', 'deleted_at')))`,
    { type: sequelize.QueryTypes.SELECT, transaction }
  );
  const has = (t, c) => rows.some(r => r.table_name === t && r.column_name === c);
  return {
    parentEventId: has('world_events', 'parent_event_id'),
    opportunityId: has('world_events', 'opportunity_id') && has('opportunities', 'id'),
    opportunitiesParanoid: has('opportunities', 'deleted_at'),
  };
}

// One CASE per link: the link's label when a live link row exists, else NULL.
function linkedByExpression(links, self) {
  const cases = links.map(({ table, column, isUuid, paranoid, label }) => {
    const col = `l.${ident(column)}`;
    const match = isUuid ? `${col} = we.id` : `${col}::text = we.id::text`;
    return `CASE WHEN EXISTS (SELECT 1 FROM ${ident(table)} l WHERE ${match}${paranoid ? ' AND l.deleted_at IS NULL' : ''}) THEN ${literal(label)} END`;
  });
  if (self.parentEventId) {
    cases.push(`CASE WHEN EXISTS (SELECT 1 FROM world_events c WHERE c.parent_event_id = we.id AND c.deleted_at IS NULL) THEN 'child_events' END`);
  }
  if (self.opportunityId) {
    cases.push(`CASE WHEN we.opportunity_id IS NOT NULL AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = we.opportunity_id${self.opportunitiesParanoid ? ' AND o.deleted_at IS NULL' : ''}) THEN 'opportunity' END`);
  }
  return cases.length ? `ARRAY_REMOVE(ARRAY[${cases.join(', ')}]::text[], NULL)` : 'ARRAY[]::text[]';
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

  // Table and column names come from the catalog, never from the request.
  const links = await discoverEventLinkColumns(sequelize, transaction);
  const linkedBy = linkedByExpression(links, await selfLinkShape(sequelize, transaction));

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

module.exports = { NON_WORLD_EVENT_COLUMNS, discoverEventLinkColumns, softDeleteUnusedUnlinkedEvents };
