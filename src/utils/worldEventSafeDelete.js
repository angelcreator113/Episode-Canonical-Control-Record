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
 * Lock, then look (Evoni, 2026-11-12): the events are locked first, and what
 * uses them is read by a second statement in the same transaction. A delete
 * that waited behind a pencil, a Start or a link therefore judges the event
 * as it is after that work committed, not as it was when the delete began.
 * Every writer that points something at an event locks the event row first
 * (seasonSlotService, seasonSpecials, the terms routes, Start Episode), so
 * the two take turns on that one lock.
 *
 * allowOwnedPreparation (single delete only; bulk delete and replace do not
 * pass it, and behave as before): an event's own untouched preparation does
 * not hold it. That is its cost lines, and its deliverables that no episode
 * and no post has been tied to and that are still pending. Those rows are
 * soft-deleted with the event, in the same transaction. A deliverable an
 * episode or a post is tied to still holds the event, as does every link
 * from an independent record.
 *
 * Callers: eventGeneratorRoute (replace_existing), worldEvents/episodeBatch
 * (bulk-delete) and worldEvents/update (DELETE one event).
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

// An event's own preparation (both reference it ON DELETE CASCADE; every
// other link is an independent record). With allowOwnedPreparation a row of
// these holds its event only while the SQL here is true of it; null: never.
const OWNED_PREPARATION = Object.freeze({
  event_costs: Object.freeze({ key: 'costs', touched: null }),
  event_deliverables: Object.freeze({
    key: 'deliverables',
    touched: ({ posts, postsParanoid }) => [
      'l.episode_id IS NOT NULL',
      "COALESCE(l.status, 'pending') <> 'pending'",
      ...(posts ? [`EXISTS (SELECT 1 FROM deliverable_posts dp WHERE dp.deliverable_id = l.id${postsParanoid ? ' AND dp.deleted_at IS NULL' : ''})`] : []),
    ].join(' OR '),
  }),
});

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

// Whether deliverable_posts is in this schema, and soft-deletable.
async function deliverablePostsShape(sequelize, transaction) {
  const rows = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'deliverable_posts' AND column_name IN ('deliverable_id', 'deleted_at')`,
    { type: sequelize.QueryTypes.SELECT, transaction }
  );
  const has = (c) => rows.some(r => r.column_name === c);
  return { posts: has('deliverable_id'), postsParanoid: has('deleted_at') };
}

// One CASE per link: the link's label when a live link row exists, else NULL.
// owned: null (every link row holds its event), or the deliverable_posts
// shape (an event's own untouched preparation does not).
function linkedByExpression(links, self, owned = null) {
  const cases = [];
  for (const { table, column, isUuid, paranoid, label } of links) {
    const mine = owned && column === 'event_id' ? OWNED_PREPARATION[table] : null;
    if (mine && !mine.touched) continue;
    const col = `l.${ident(column)}`;
    const match = isUuid ? `${col} = we.id` : `${col}::text = we.id::text`;
    const touched = mine ? ` AND (${mine.touched(owned)})` : '';
    cases.push(`CASE WHEN EXISTS (SELECT 1 FROM ${ident(table)} l WHERE ${match}${paranoid ? ' AND l.deleted_at IS NULL' : ''}${touched}) THEN ${literal(label)} END`);
  }
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
 * @param {boolean} [opts.allowOwnedPreparation]  see the header; default false
 * @param opts.transaction          required: the caller's transaction
 * @returns {{ softDeleted: {id,name}[], kept: {id,name,status,used,linked_by}[], notFound: string[],
 *             ownedRemoved: { [eventId]: { deliverables: number, costs: number } } }}
 *   ownedRemoved has an entry per soft-deleted event, and only with allowOwnedPreparation.
 */
async function softDeleteUnusedUnlinkedEvents(sequelize, { showId, ids = null, status = null, allowOwnedPreparation = false, transaction }) {
  if (!transaction) throw new Error('softDeleteUnusedUnlinkedEvents needs a transaction');

  let notFound = [];
  let wantedIds = null;
  if (ids) {
    wantedIds = [...new Set(ids.map(String))];
    notFound = wantedIds.filter(id => !UUID_RE.test(id));
    wantedIds = wantedIds.filter(id => UUID_RE.test(id));
    if (wantedIds.length === 0) return { softDeleted: [], kept: [], notFound, ownedRemoved: {} };
  }

  // Table and column names come from the catalog, never from the request.
  const links = await discoverEventLinkColumns(sequelize, transaction);
  const owned = allowOwnedPreparation ? await deliverablePostsShape(sequelize, transaction) : null;
  const linkedBy = linkedByExpression(links, await selfLinkShape(sequelize, transaction), owned);

  const where = ['we.show_id = :showId', 'we.deleted_at IS NULL'];
  if (wantedIds) where.push('we.id IN (:ids)');
  if (status) where.push('we.status = :status');

  // 1. Lock, in id order (one order for every multi-event lock here). A row
  //    another transaction holds is waited for; when that transaction
  //    commits, a row it deleted or moved out of the filter is left out.
  const locked = await sequelize.query(
    `SELECT we.id FROM world_events we WHERE ${where.join(' AND ')} ORDER BY we.id FOR UPDATE OF we`,
    { replacements: { showId, ids: wantedIds, status }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  const lockedIds = locked.map(r => r.id);

  // 2. Look, with the rows held: a new statement, so it reads what was
  //    committed while step 1 waited (a pencil, a Start, a link).
  const rows = lockedIds.length === 0 ? [] : await sequelize.query(
    `SELECT we.id, we.name, we.status,
            (COALESCE(we.status, '') IN ('used', 'filmed')
              OR we.used_in_episode_id IS NOT NULL
              OR COALESCE(we.times_used, 0) > 0) AS used,
            ${linkedBy} AS linked_by
       FROM world_events we
      WHERE we.id IN (:lockedIds) AND we.show_id = :showId AND we.deleted_at IS NULL`,
    { replacements: { showId, lockedIds }, type: sequelize.QueryTypes.SELECT, transaction }
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

  const ownedRemoved = {};
  if (softDeleted.length > 0) {
    const deletedIds = softDeleted.map(e => e.id);
    await sequelize.query(
      `UPDATE world_events SET deleted_at = NOW(), updated_at = NOW()
        WHERE id IN (:ids) AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { ids: deletedIds, showId }, transaction }
    );
    if (owned) {
      // The event's own preparation goes with it. Only rows that did not
      // hold it are left by now (a touched deliverable kept the event), and
      // nothing can add one: the terms routes lock the event row first.
      for (const id of deletedIds) ownedRemoved[id] = { deliverables: 0, costs: 0 };
      for (const { table, column, paranoid } of links) {
        const mine = column === 'event_id' ? OWNED_PREPARATION[table] : null;
        if (!mine || !paranoid) continue;
        const removed = await sequelize.query(
          `UPDATE ${ident(table)} SET deleted_at = NOW(), updated_at = NOW()
            WHERE event_id IN (:ids) AND deleted_at IS NULL RETURNING event_id`,
          { replacements: { ids: deletedIds }, type: sequelize.QueryTypes.SELECT, transaction }
        );
        for (const row of removed) if (ownedRemoved[row.event_id]) ownedRemoved[row.event_id][mine.key] += 1;
      }
    }
  }
  return { softDeleted, kept, notFound, ownedRemoved };
}

module.exports = { NON_WORLD_EVENT_COLUMNS, OWNED_PREPARATION, discoverEventLinkColumns, softDeleteUnusedUnlinkedEvents };
