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
  return sequelize.transaction(async (transaction) => {
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

module.exports = {
  locationApprovingSet,
  baseReplaceRefusal,
  assertBaseReplaceable,
  ApprovedBaseError,
  approveBase,
  unapproveBase,
  approvalsForSets,
};
