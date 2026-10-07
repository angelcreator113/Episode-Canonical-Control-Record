'use strict';

/**
 * Show-library overlays in an episode (Evoni, 2026-10-07: "show level
 * overlays hold overlays that can be used for any episode while episode
 * overlays are for that episode only").
 *
 * A show overlay (a show-level UI_OVERLAY asset: the show's title, a lower
 * third, a button) is used in an episode by placing it on one of the
 * episode's beats, the same beat-anchored timeline_placements row the
 * invitation and the task-list overlay get (episodeBeatPlacement). The
 * episode only points at the show's image; the image itself is edited in
 * the show's Overlays library.
 *
 *   listEpisodeBeats      the episode's beats (scene_plans), for the picker;
 *   libraryPlacements     which show overlays the episode places, and where;
 *   placeLibraryOverlay   place (or move) one on a beat;
 *   removeLibraryOverlay  take it off the episode.
 */

const { placeOverlayOnBeat } = require('./episodeBeatPlacement');

class LibraryOverlayError extends Error {
  constructor(message, status = 400, code = 'LIBRARY_OVERLAY_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const parseProps = (value) => {
  if (!value) return {};
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[LibraryOverlays] placement properties parse failed:', err.message);
    return {};
  }
};

/** "UI Overlay: Show Title" → "Show Title". */
const overlayName = (name) => String(name || 'Overlay').replace(/^UI Overlay:\s*/i, '');

/** The episode's beats, in order: [{ number, name }]. */
async function listEpisodeBeats(sequelize, episodeId) {
  const rows = await sequelize.query(
    `SELECT DISTINCT ON (beat_number) beat_number, beat_name FROM scene_plans
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND beat_number IS NOT NULL
      ORDER BY beat_number, sort_order ASC, created_at ASC`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT });
  return rows.map((r) => ({ number: Number(r.beat_number), name: r.beat_name || null }));
}

/**
 * The show overlays this episode places: [{ asset_id, name, beat: { number, name } | null }].
 * Only show-level assets (episode_id NULL) of the episode's show.
 */
async function libraryPlacements(sequelize, { episodeId, showId }) {
  const rows = await sequelize.query(
    `SELECT DISTINCT ON (tp.asset_id) tp.asset_id, a.name, tp.properties
       FROM timeline_placements tp
       JOIN assets a ON a.id = tp.asset_id AND a.asset_type = 'UI_OVERLAY'
                    AND a.show_id = :showId AND a.episode_id IS NULL AND a.deleted_at IS NULL
      WHERE tp.episode_id = :episodeId AND tp.deleted_at IS NULL
      ORDER BY tp.asset_id, tp.created_at DESC`,
    { replacements: { episodeId, showId }, type: sequelize.QueryTypes.SELECT });
  return rows.map((r) => {
    const props = parseProps(r.properties);
    const number = props.beat_number == null ? null : Number(props.beat_number);
    return {
      asset_id: r.asset_id,
      name: overlayName(r.name),
      beat: Number.isFinite(number) ? { number, name: props.beat_name || null } : null,
    };
  });
}

async function loadEpisode(sequelize, episodeId) {
  const [ep] = await sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT });
  if (!ep) throw new LibraryOverlayError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  return ep;
}

async function loadShowOverlay(sequelize, { assetId, showId }) {
  const [asset] = await sequelize.query(
    `SELECT id, name FROM assets
      WHERE id = :assetId AND asset_type = 'UI_OVERLAY' AND show_id = :showId
        AND episode_id IS NULL AND deleted_at IS NULL LIMIT 1`,
    { replacements: { assetId, showId }, type: sequelize.QueryTypes.SELECT });
  if (!asset) throw new LibraryOverlayError("That overlay is not one of this show's overlays", 404, 'OVERLAY_NOT_FOUND');
  return asset;
}

/**
 * Place a show overlay on one of the episode's beats, or move it there if
 * the episode already places it. Returns { asset_id, beat }.
 */
async function placeLibraryOverlay(models, { episodeId, assetId, beatNumber }) {
  const { sequelize } = models;
  const number = Number(beatNumber);
  if (!assetId) throw new LibraryOverlayError('asset_id is required');
  if (!Number.isInteger(number) || number < 1) throw new LibraryOverlayError('beat_number must be a beat of the episode');
  const ep = await loadEpisode(sequelize, episodeId);
  const asset = await loadShowOverlay(sequelize, { assetId, showId: ep.show_id });
  const beat = (await listEpisodeBeats(sequelize, episodeId)).find((b) => b.number === number);
  if (!beat) throw new LibraryOverlayError(`The episode has no beat ${number}`, 400, 'BEAT_NOT_FOUND');
  const { placement, anchor } = await placeOverlayOnBeat(models, {
    episodeId,
    assetId: asset.id,
    canonicalBeat: { number: beat.number, name: beat.name || `Beat ${beat.number}` },
    label: overlayName(asset.name),
    kind: 'show_overlay',
    source: 'show_library',
    logTag: '[LibraryOverlays]',
  });
  if (!placement || anchor !== 'beat') throw new LibraryOverlayError('Could not place the overlay', 500, 'PLACE_FAILED');
  return { asset_id: asset.id, beat: { number: beat.number, name: beat.name } };
}

/** Take a show overlay off the episode (its placements are soft-deleted). Returns how many. */
async function removeLibraryOverlay(sequelize, { episodeId, assetId }) {
  const ep = await loadEpisode(sequelize, episodeId);
  await loadShowOverlay(sequelize, { assetId, showId: ep.show_id });
  const [, meta] = await sequelize.query(
    `UPDATE timeline_placements SET deleted_at = NOW(), updated_at = NOW()
      WHERE episode_id = :episodeId AND asset_id = :assetId AND deleted_at IS NULL`,
    { replacements: { episodeId, assetId } });
  return meta?.rowCount ?? 0;
}

module.exports = {
  LibraryOverlayError,
  overlayName,
  listEpisodeBeats,
  libraryPlacements,
  placeLibraryOverlay,
  removeLibraryOverlay,
};
