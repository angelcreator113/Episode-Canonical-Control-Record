'use strict';

/**
 * A recurring location's approved permanent base image (ruling S6, Evoni
 * 2026-09-30; her answers of 2026-10-01; EVENT_EPISODE_FLOW.md §8(dd)).
 *
 *   "A recurring location keeps one approved permanent base image;
 *   event-dressed versions are made from it, so the place stays
 *   recognisable across episodes."
 *
 *   1. The approved base lives on the World Location (a field naming its
 *      approved base image).
 *   3. Regenerate, promote-to-base and restyle refuse to replace an
 *      approved base until Evoni un-approves it.
 *   4. Nothing is approved automatically; Evoni approves each base from
 *      Scene Sets.
 *
 * world_locations.approved_base_scene_set_id / approved_base_image_url /
 * approved_base_at (migration 20261001220000).
 */

/** The World Location whose approved base is this scene set's, or null. */
async function locationApprovingSet(sequelize, sceneSetId, { transaction } = {}) {
  if (!sceneSetId) return null;
  const [rows] = await sequelize.query(
    `SELECT id, name, approved_base_scene_set_id, approved_base_image_url, approved_base_at
       FROM world_locations
      WHERE approved_base_scene_set_id = :id AND deleted_at IS NULL LIMIT 1`,
    { replacements: { id: sceneSetId }, transaction }
  );
  return rows?.[0] || null;
}

/**
 * null when the set's base may be replaced; otherwise { status: 409, error }
 * naming the location whose approved base it is (answer 3).
 */
async function baseReplaceRefusal(sequelize, sceneSetId) {
  const location = await locationApprovingSet(sequelize, sceneSetId);
  if (!location) return null;
  return {
    status: 409,
    error: `This base is the approved base of ${location.name}. Un-approve it in Scene Sets before replacing it.`,
    approved_base_of: { world_location_id: location.id, name: location.name },
  };
}

/**
 * null when the set may be linked to nextLocationId (an id, or null to
 * unlink); otherwise { status, error }. The location must exist; a set whose
 * base is its location's approved base keeps that location until the base is
 * un-approved, so the location never points at a set that is elsewhere.
 */
async function locationChangeRefusal(sequelize, sceneSet, nextLocationId) {
  const next = nextLocationId || null;
  if ((sceneSet.world_location_id || null) === next) return null;
  if (next) {
    const [rows] = await sequelize.query(
      'SELECT id FROM world_locations WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: next } }
    );
    if (!rows?.length) return { status: 400, error: 'world_location_id must be an existing World Location' };
  }
  const approving = await locationApprovingSet(sequelize, sceneSet.id);
  if (approving) {
    return { status: 409, error: `This set's base is the approved base of ${approving.name}. Un-approve it before changing its World Location.` };
  }
  return null;
}

/** Same window as the scene-set generation claim (sceneSetRoutes). */
const GENERATION_STALE_MINUTES = 15;

/** Thrown by generation when it would replace an approved base. */
class ApprovedBaseError extends Error {
  constructor(refusal) {
    super(refusal.error);
    this.name = 'ApprovedBaseError';
    this.status = refusal.status;
  }
}

async function assertBaseReplaceable(sequelize, sceneSetId) {
  const refusal = await baseReplaceRefusal(sequelize, sceneSetId);
  if (refusal) throw new ApprovedBaseError(refusal);
}

/**
 * Approve a scene set's base as its World Location's (answer 4: by Evoni,
 * from Scene Sets). { status, error } when it cannot be; { location } when
 * done. A location keeps one approved base: another set's must be
 * un-approved first.
 */
async function approveBase(sequelize, sceneSet) {
  if (!sceneSet.world_location_id) return { status: 400, error: 'This scene set has no World Location to approve its base for.' };
  if (!sceneSet.base_still_url) return { status: 400, error: 'This scene set has no base image to approve.' };
  // An event version is the place dressed for one event, not how it usually
  // looks (seventh audit).
  if (sceneSet.version_of_set_id) return { status: 409, code: 'IS_EVENT_VERSION', error: 'This set is an event version: its photos are one event\'s, not the location\'s everyday look.' };
  return sequelize.transaction(async (transaction) => {
    // A base being generated is about to be replaced: approving it now would
    // let the run overwrite the approved picture. A claim older than the
    // generation stale window is a run that died and does not block.
    const [setRows] = await sequelize.query(
      `SELECT name, (generation_status = 'generating'
                     AND updated_at > NOW() - make_interval(mins => :stale)) AS generating
         FROM scene_sets WHERE id = :id LIMIT 1 FOR UPDATE`,
      { replacements: { id: sceneSet.id, stale: GENERATION_STALE_MINUTES }, transaction }
    );
    if (setRows?.[0]?.generating) {
      return { status: 409, error: `The base of "${setRows[0].name}" is being generated. Approve it when it is done.` };
    }
    const [rows] = await sequelize.query(
      `SELECT id, name, approved_base_scene_set_id FROM world_locations
        WHERE id = :id AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
      { replacements: { id: sceneSet.world_location_id }, transaction }
    );
    const location = rows?.[0];
    if (!location) return { status: 404, error: 'World Location not found' };
    if (location.approved_base_scene_set_id && location.approved_base_scene_set_id !== sceneSet.id) {
      return { status: 409, error: `${location.name} already has an approved base. Un-approve it first.`, approved_scene_set_id: location.approved_base_scene_set_id };
    }
    const [updated] = await sequelize.query(
      `UPDATE world_locations
          SET approved_base_scene_set_id = :setId, approved_base_image_url = :url, approved_base_at = NOW(), updated_at = NOW()
        WHERE id = :id
        RETURNING id, name, approved_base_scene_set_id, approved_base_image_url, approved_base_at`,
      { replacements: { id: location.id, setId: sceneSet.id, url: sceneSet.base_still_url }, transaction }
    );
    return { location: updated[0] };
  });
}

/** Un-approve: only the set whose base is approved can be un-approved. */
async function unapproveBase(sequelize, sceneSet) {
  const location = await locationApprovingSet(sequelize, sceneSet.id);
  if (!location) return { status: 409, error: 'This scene set\'s base is not an approved base.' };
  const [updated] = await sequelize.query(
    `UPDATE world_locations
        SET approved_base_scene_set_id = NULL, approved_base_image_url = NULL, approved_base_at = NULL, updated_at = NOW()
      WHERE id = :id
      RETURNING id, name`,
    { replacements: { id: location.id } }
  );
  return { location: updated[0] };
}

/**
 * For a list of scene sets: base_approved (its base is its location's
 * approved base) and location_approved_base ({ scene_set_id, image_url }
 * of its location's approved base, or null).
 */
async function approvalsForSets(sequelize, sets) {
  const locationIds = [...new Set((sets || []).map((s) => s.world_location_id).filter(Boolean))];
  if (!locationIds.length) return new Map();
  const [rows] = await sequelize.query(
    `SELECT id, approved_base_scene_set_id, approved_base_image_url FROM world_locations
      WHERE id IN (:ids) AND approved_base_scene_set_id IS NOT NULL AND deleted_at IS NULL`,
    { replacements: { ids: locationIds } }
  );
  return new Map(rows.map((r) => [r.id, { scene_set_id: r.approved_base_scene_set_id, image_url: r.approved_base_image_url }]));
}

/* ── Deleting a World Location (Evoni, 2026-11-22) ─────────────────────────
 *
 * The one delete both routes use (DELETE /api/v1/world/locations/:id and
 * DELETE /api/v1/tier/world-locations/:locationId). A location that anything
 * live still uses is not deleted: its foreign keys are ON DELETE SET NULL
 * (scene sets, event venues, calendar events, profile homes), so a delete
 * silently unlinked them, went round the Place lock and dropped an approved
 * base with its row.
 *
 * One transaction. It locks the location row FOR UPDATE and nothing else,
 * then reads. Inserting or re-pointing a row whose foreign key names the
 * location takes a key-share lock on that same row, so such an attach and
 * this delete take turns: the delete sees the committed attach and refuses,
 * or the attach finds the location gone and fails on its foreign key.
 * References with no foreign key (feed posts, look variants, timeline
 * events, the JSONB copies) are read here, and their writers do not wait on
 * this lock.
 *
 * There is no override. Refusals, in this order:
 *   1. PLACE_LOCKED: a live event at the location, or held at one of its
 *      sets, whose episode is accepted (utils/placeLock).
 *   2. the approved base (S6): un-approve it first.
 *   3. LOCATION_IN_USE: the counts, by kind.
 * A soft-deleted referrer does not block. The one exception is a location
 * inside this one: its foreign key has no ON DELETE action, so any such row
 * blocks the delete in the database and is counted whatever its deleted_at.
 */

const LOCATION_IN_USE_CODE = 'LOCATION_IN_USE';
const LOCATION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Each kind of use: its count, and how a person reads one or many of it.
const LOCATION_USES = [
  ['child_locations', 'location inside it', 'locations inside it',
    'SELECT COUNT(*) n FROM world_locations WHERE parent_location_id = :id'],
  ['scene_sets', 'scene set', 'scene sets',
    'SELECT COUNT(*) n FROM scene_sets WHERE world_location_id = :id AND deleted_at IS NULL'],
  ['events', 'event', 'events',
    `SELECT COUNT(*) n FROM world_events
      WHERE deleted_at IS NULL
        AND (venue_location_id = :id OR canon_consequences->'automation'->>'venue_location_id' = :idText)`],
  ['looks', 'event look', 'event looks',
    `SELECT COUNT(*) n FROM scene_set_looks sl JOIN scene_sets s ON s.id = sl.scene_set_id AND s.deleted_at IS NULL
      WHERE sl.deleted_at IS NULL AND sl.brief->>'world_location_id' = :idText`],
  ['look_variants', 'look variant', 'look variants',
    'SELECT COUNT(*) n FROM location_look_variants WHERE world_location_id = :id AND deleted_at IS NULL'],
  ['calendar_events', 'calendar event', 'calendar events',
    'SELECT COUNT(*) n FROM story_calendar_events WHERE location_id = :id'],
  ['profile_homes', 'profile based there', 'profiles based there',
    'SELECT COUNT(*) n FROM social_profiles WHERE home_location_id = :id AND deleted_at IS NULL'],
  ['profile_venues', 'profile that goes there', 'profiles that go there',
    `SELECT COUNT(*) n FROM social_profiles
      WHERE deleted_at IS NULL AND jsonb_typeof(frequent_venues) = 'array' AND frequent_venues @> to_jsonb(CAST(:idText AS text))`],
  ['feed_posts', 'feed post', 'feed posts',
    'SELECT COUNT(*) n FROM feed_posts WHERE place_location_id = :id AND deleted_at IS NULL'],
  ['timeline_events', 'timeline event', 'timeline events',
    'SELECT COUNT(*) n FROM world_timeline_events WHERE location_id = :id AND deleted_at IS NULL'],
];

const listed = (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]);

/** Live uses of a location, counted by kind, with their total. */
async function locationUses(sequelize, locationId, { transaction } = {}) {
  const uses = {};
  let total = 0;
  for (const [kind, , , sql] of LOCATION_USES) {
    const [rows] = await sequelize.query(sql, { replacements: { id: locationId, idText: String(locationId) }, transaction });
    uses[kind] = Number(rows?.[0]?.n || 0);
    total += uses[kind];
  }
  return { ...uses, total };
}

/** Live events at the location, or held at one of its live sets, whose Place is locked: [{ id, name }]. */
async function lockedEventsAtLocation(sequelize, locationId, { transaction } = {}) {
  const [events] = await sequelize.query(
    `SELECT id, name FROM world_events
      WHERE deleted_at IS NULL
        AND (venue_location_id = :id
             OR canon_consequences->'automation'->>'venue_location_id' = :idText
             OR scene_set_id IN (SELECT id FROM scene_sets WHERE world_location_id = :id AND deleted_at IS NULL))
      ORDER BY name, id`,
    { replacements: { id: locationId, idText: String(locationId) }, transaction });
  const { isPlaceLocked } = require('../utils/placeLock');
  const locked = [];
  for (const e of events) if (await isPlaceLocked(sequelize, e.id, { transaction })) locked.push({ id: e.id, name: e.name });
  return locked;
}

const inUse = (error, uses = {}) => ({ status: 409, body: { success: false, code: LOCATION_IN_USE_CODE, uses, error } });

/**
 * Delete a World Location nothing uses. Resolves { status: 200, deleted:
 * { id, name } }, or { status, body } to send as it is: 404 (no such
 * location), 409 (a refusal above, or RETRY when it lost a lock wait).
 * Nothing is changed unless the status is 200. userId is the activity log's.
 */
async function deleteWorldLocation(sequelize, locationId, { userId = null } = {}) {
  const notFound = { status: 404, body: { error: 'Not found' } };
  // An id that is no uuid names no location (and would be a database cast error).
  if (!LOCATION_UUID_RE.test(String(locationId || ''))) return notFound;
  const { LOCK_TIMEOUT, asRetryable, RetryableConflictError } = require('../utils/episodeLocks');
  try {
    return await sequelize.transaction(async (transaction) => {
      await sequelize.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`, { transaction });
      const [rows] = await sequelize.query(
        `SELECT id, name, slug, location_type, city, approved_base_scene_set_id, approved_base_image_url
           FROM world_locations WHERE id = :id FOR UPDATE`,
        { replacements: { id: locationId }, transaction });
      const location = rows?.[0];
      if (!location) return notFound;

      const locked = await lockedEventsAtLocation(sequelize, location.id, { transaction });
      if (locked.length) {
        const { PLACE_LOCKED_CODE } = require('../utils/placeLock');
        const one = locked.length === 1;
        return {
          status: 409,
          body: {
            success: false, code: PLACE_LOCKED_CODE, locked_events: locked,
            error: `${locked.map((e) => e.name).join(', ')} ${one ? 'is' : 'are'} held here and ${one ? 'its episode is' : 'their episodes are'} accepted: the place is locked, so this location stays. Nothing was deleted.`,
          },
        };
      }

      if (location.approved_base_scene_set_id || location.approved_base_image_url) {
        return {
          status: 409,
          body: {
            success: false,
            error: `${location.name} has an approved base. Un-approve it in Scene Sets before deleting the location. Nothing was deleted.`,
            approved_base_of: { world_location_id: location.id, name: location.name },
          },
        };
      }

      const { total, ...uses } = await locationUses(sequelize, location.id, { transaction });
      if (total > 0) {
        const parts = LOCATION_USES.filter(([kind]) => uses[kind] > 0)
          .map(([kind, one, many]) => `${uses[kind]} ${uses[kind] === 1 ? one : many}`);
        return inUse(`${location.name} is used by ${listed(parts)}. Nothing was deleted.`, uses);
      }

      await sequelize.query('DELETE FROM world_locations WHERE id = :id', { replacements: { id: location.id }, transaction });
      // In this transaction: a delete that cannot be recorded does not happen.
      await require('../middleware/auditLog').logger.logActionInTransaction(
        transaction, userId, 'delete', 'world_location', location.id,
        { oldValues: { name: location.name, slug: location.slug, location_type: location.location_type, city: location.city } });
      return { status: 200, deleted: { id: location.id, name: location.name } };
    });
  } catch (err) {
    const retry = asRetryable(err);
    if (retry instanceof RetryableConflictError) {
      console.warn(`[WorldLocation] delete of ${locationId} refused (${retry.code}):`, retry.message);
      return { status: 409, body: { success: false, error: retry.message, code: retry.code } };
    }
    // A row this file does not count still names the location through a
    // foreign key with no ON DELETE action: the database refused the delete.
    if ((err?.original?.code || err?.parent?.code) === '23503') {
      console.error(`[WorldLocation] delete of ${locationId} refused by a foreign key:`, err.original?.constraint || err.message);
      return inUse('Something else still refers to this location. Nothing was deleted.');
    }
    throw err;
  }
}

module.exports = {
  locationApprovingSet,
  baseReplaceRefusal,
  locationChangeRefusal,
  assertBaseReplaceable,
  ApprovedBaseError,
  approveBase,
  unapproveBase,
  approvalsForSets,
  LOCATION_IN_USE_CODE,
  locationUses,
  lockedEventsAtLocation,
  deleteWorldLocation,
};
