'use strict';

/**
 * timelinePlacementService — small helpers for auto-creating timeline
 * placements when video UI overlays come into existence (invitation
 * approved, to-do list locked, etc.). Keeps the placement defaults in
 * one place so the routes that trigger them stay short and consistent.
 *
 * Why placements are created on these events:
 *   - approve-invitation → the invite asset gets `episode_id` stamped
 *     on it, but nothing tells the timeline "play this overlay
 *     anywhere." Without a placement, it just sits in storage. The
 *     video composer (when it lands) reads placements to know what to
 *     draw and when.
 *   - todo lock → the user has finalized the wardrobe checklist for
 *     the episode. We create an Asset row (so it can be referenced
 *     with an FK) and a placement so it queues up for video render.
 *
 * Idempotent: helpers refuse to create a duplicate placement for the
 * same (episode_id, asset_id) pair, so re-approving / re-locking
 * doesn't pile up rows. Updating an existing placement is a separate
 * UI/API concern.
 */

/**
 * Resolve the first scene id for an episode, used as the default
 * attachment point for new placements. Falls back to null when the
 * episode has no scenes yet — the placement can still exist as
 * time-based later or get re-attached when scenes appear.
 */
async function findFirstSceneId(sequelize, episodeId) {
  if (!sequelize || !episodeId) return null;
  try {
    const [rows] = await sequelize.query(
      `SELECT id FROM scenes
        WHERE episode_id = :episodeId AND deleted_at IS NULL
        ORDER BY scene_number ASC, created_at ASC
        LIMIT 1`,
      { replacements: { episodeId } }
    );
    return rows?.[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * Create a TimelinePlacement for an Asset on an Episode. Idempotent —
 * returns the existing placement if one already exists for that
 * (episode_id, asset_id) pair. Defaults aim for a sensible first cut
 * the creator can adjust later: scene-start of the first scene, 5s
 * duration, z-index 10, overlay role.
 */
async function placeOverlayOnFirstScene(models, { episodeId, assetId, defaults = {} }) {
  if (!models || !episodeId || !assetId) return null;
  const { TimelinePlacement, sequelize } = models;
  if (!TimelinePlacement) return null;

  // Idempotent guard — if a placement already exists for this asset on
  // this episode, return it untouched so re-running the trigger doesn't
  // duplicate.
  const existing = await TimelinePlacement.findOne({
    where: { episode_id: episodeId, asset_id: assetId, deleted_at: null },
  }).catch(() => null);
  if (existing) return existing;

  const sceneId = defaults.sceneId === undefined
    ? await findFirstSceneId(sequelize, episodeId)
    : defaults.sceneId;

  return TimelinePlacement.create({
    episode_id: episodeId,
    placement_type: 'asset',
    asset_id: assetId,
    scene_id: sceneId,
    attachment_point: defaults.attachmentPoint || 'scene-start',
    offset_seconds: defaults.offsetSeconds ?? 0,
    track_number: defaults.trackNumber ?? 2,
    duration: defaults.duration ?? 5,
    z_index: defaults.zIndex ?? 10,
    visual_role: defaults.visualRole || 'overlay',
    properties: defaults.properties || {},
  }).catch((err) => {
    // Auto-placement should never block the upstream action. Log and
    // move on — the creator can add it manually from the placements UI
    // if it didn't take.
    console.warn('[timelinePlacementService] Failed to create placement:', err.message);
    return null;
  });
}

/**
 * Auto-place every overlay listed in event.required_ui_overlays at episode
 * generation time. Each entry in `requiredKeys` is matched against
 * ui_overlay_types by either type_key or name (matches the defaultValue
 * shape on world_events.required_ui_overlays — string keys, not UUIDs).
 *
 * For each matched type we pick the best available asset:
 *   1. Episode-specific asset (asset.episode_id = episodeId) if one exists,
 *   2. otherwise the most recent show-wide asset.
 * If no generated asset exists yet, that overlay is silently skipped — the
 * creator can place it manually once the asset is generated, or re-run this
 * helper after generation. Failures never throw; episode generation is the
 * happy path and a missing overlay is an edit nudge, not an error.
 *
 * Returns an array of `{ type_key, name, category, placement_id }` for the
 * overlays that successfully landed, so the generator can log a one-line
 * summary.
 */
async function autoPlaceRequiredOverlays(models, { showId, episodeId, requiredKeys }) {
  if (!models || !showId || !episodeId) return [];
  if (!Array.isArray(requiredKeys) || requiredKeys.length === 0) return [];
  const { sequelize } = models;
  if (!sequelize) return [];

  let types = [];
  try {
    const [rows] = await sequelize.query(
      `SELECT id, type_key, name, category
         FROM ui_overlay_types
        WHERE show_id = :showId AND deleted_at IS NULL
          AND (type_key = ANY(:keys) OR name = ANY(:keys))`,
      { replacements: { showId, keys: requiredKeys } }
    );
    types = rows || [];
  } catch (err) {
    console.warn('[timelinePlacementService] required overlay type lookup failed:', err.message);
    return [];
  }

  const placed = [];
  for (const t of types) {
    let assetId = null;
    try {
      // Prefer an episode-specific asset over a show-wide one — same
      // precedence the read endpoint uses (uiOverlayRoutes.js merge logic).
      const [assets] = await sequelize.query(
        `SELECT id FROM assets
          WHERE show_id = :showId AND deleted_at IS NULL
            AND (episode_id = :episodeId OR episode_id IS NULL)
            AND (metadata->>'overlay_type' = :typeId
                 OR metadata->>'overlay_type' = :typeKey)
          ORDER BY (episode_id IS NOT NULL) DESC, created_at DESC
          LIMIT 1`,
        { replacements: { showId, episodeId, typeId: t.id, typeKey: t.type_key } }
      );
      assetId = assets?.[0]?.id || null;
    } catch (err) {
      console.warn(`[timelinePlacementService] asset lookup for ${t.type_key} failed:`, err.message);
      continue;
    }
    if (!assetId) continue;

    const placement = await placeOverlayOnFirstScene(models, { episodeId, assetId });
    if (placement) {
      placed.push({
        type_key: t.type_key,
        name: t.name,
        category: t.category || 'phone',
        placement_id: placement.id,
      });
    }
  }
  return placed;
}

module.exports = {
  findFirstSceneId,
  placeOverlayOnFirstScene,
  autoPlaceRequiredOverlays,
};
