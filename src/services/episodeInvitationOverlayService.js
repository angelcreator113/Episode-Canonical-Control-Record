'use strict';

/**
 * episodeInvitationOverlayService — P10 (Evoni, 2026-09-30; Task #2386):
 *
 *   "An event's approved invitation is an episode overlay: tagged as the
 *    episode's invitation overlay, shown in that episode's overlays and
 *    placed on the invitation beat, whether approved before or after Start
 *    Episode. Regenerating and approving a new one replaces it. The Phone
 *    Hub keeps show-wide overlays only; an episode's Lala's Phone shows
 *    show-wide plus that episode's own."
 *
 * The invitation stays an `INVITATION_LETTER` asset (its own version
 * history, approve/reject and re-render all key on that type). What makes
 * it the episode's invitation overlay is:
 *   - it is the event's current approved invitation
 *     (world_events.invitation_asset_id, approval_status 'approved'),
 *   - the event has an episode (used_in_episode_id, or the episode Start
 *     Episode just created), and
 *   - its row carries episode_id plus metadata.overlay_type (the show's
 *     invitation overlay type key, else 'InviteLetterOverlay') and
 *     metadata.episode_invitation = true.
 *
 * Only that one asset is tagged; every other version of the event's
 * invitation is untagged and marked superseded, and its placement on the
 * episode is removed, so exactly one invitation is placed.
 *
 * "The invitation beat" is the canonical beat whose screen_action is
 * OPEN_LETTER_INVITE_OVERLAY (beat 5, "Reveal" — src/constants/canonicalBeats.js),
 * i.e. the episode's scene_plans row with that beat_number. scenes rows
 * carry no beat link, so a beat-anchored placement has scene_id null and
 * records the beat in properties (anchor 'beat', beat_number, beat_name,
 * scene_plan_id) and in its label. Only when the episode has no such
 * scene_plans row does it fall back to the first-scene placement
 * (placeOverlayOnFirstScene's default), marked anchor 'first-scene'; a
 * later sync moves it onto the beat once the beat exists.
 */

const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
const { placeOverlayOnFirstScene, normalizeOverlayKey } = require('./timelinePlacementService');

const INVITATION_SCREEN_ACTION = 'OPEN_LETTER_INVITE_OVERLAY';
const INVITATION_BEAT = CANONICAL_BEATS.find((b) => b.screen_action === INVITATION_SCREEN_ACTION) || null;
const DEFAULT_INVITATION_OVERLAY_KEY = 'InviteLetterOverlay';

// Spellings of the invitation overlay type in circulation, normalized via
// normalizeOverlayKey ('InviteLetterOverlay' is required_ui_overlays' own
// default and the script tag's name).
const INVITATION_TYPE_KEYS = new Set([
  'inviteletteroverlay', 'inviteletter', 'invitationletter',
  'invitationoverlay', 'inviteoverlay', 'invitation',
]);

function isInvitationOverlayType(typeKey, name) {
  return INVITATION_TYPE_KEYS.has(normalizeOverlayKey(typeKey))
    || INVITATION_TYPE_KEYS.has(normalizeOverlayKey(name));
}

/** The show's invitation overlay type_key, else 'InviteLetterOverlay'. */
async function resolveInvitationOverlayKey(sequelize, showId) {
  if (!showId) return DEFAULT_INVITATION_OVERLAY_KEY;
  try {
    const [rows] = await sequelize.query(
      `SELECT type_key, name FROM ui_overlay_types
        WHERE show_id = :showId AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC`,
      { replacements: { showId } }
    );
    const match = (rows || []).find((t) => isInvitationOverlayType(t.type_key, t.name));
    return match?.type_key || DEFAULT_INVITATION_OVERLAY_KEY;
  } catch (err) {
    console.warn('[episodeInvitationOverlay] overlay type lookup failed:', err.message);
    return DEFAULT_INVITATION_OVERLAY_KEY;
  }
}

/** The episode's invitation beat (scene_plans row), or null. */
async function findInvitationBeat(sequelize, episodeId) {
  if (!INVITATION_BEAT || !episodeId) return null;
  try {
    const [rows] = await sequelize.query(
      `SELECT id, beat_number, beat_name FROM scene_plans
        WHERE episode_id = :episodeId AND beat_number = :beatNumber AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1`,
      { replacements: { episodeId, beatNumber: INVITATION_BEAT.number } }
    );
    return rows?.[0] || null;
  } catch (err) {
    console.warn('[episodeInvitationOverlay] invitation beat lookup failed:', err.message);
    return null;
  }
}

/**
 * Place (or move) the invitation on the episode's invitation beat; first
 * scene only when the episode has no invitation beat. Idempotent: one
 * placement per (episode, asset) — placeOverlayOnFirstScene's guard — and
 * an existing placement not yet on the beat is moved onto it.
 */
async function placeInvitationOnBeat(models, { episodeId, assetId }) {
  if (!models?.TimelinePlacement || !episodeId || !assetId) return { placement: null, anchor: null, beat: null };
  const beat = await findInvitationBeat(models.sequelize, episodeId);
  const base = { kind: 'invitation', source: 'episode-invitation-overlay' };
  let defaults;
  if (beat) {
    defaults = {
      sceneId: null,
      duration: 5,
      zIndex: 20,
      label: `Invitation — Beat ${beat.beat_number}: ${beat.beat_name || INVITATION_BEAT.name}`,
      properties: {
        ...base,
        anchor: 'beat',
        beat_number: beat.beat_number,
        beat_name: beat.beat_name || INVITATION_BEAT.name,
        scene_plan_id: beat.id,
        screen_action: INVITATION_SCREEN_ACTION,
      },
    };
  } else {
    defaults = { duration: 5, zIndex: 20, properties: { ...base, anchor: 'first-scene' } };
  }

  let placement = await placeOverlayOnFirstScene(models, { episodeId, assetId, defaults });
  if (placement && beat) {
    const props = placement.properties || {};
    if (props.anchor !== 'beat' || props.beat_number !== beat.beat_number || props.scene_plan_id !== beat.id) {
      try {
        placement = await placement.update({
          scene_id: null,
          label: defaults.label,
          properties: { ...props, ...defaults.properties },
        });
      } catch (err) {
        console.warn('[episodeInvitationOverlay] moving placement onto the invitation beat failed:', err.message);
      }
    }
  }
  return { placement, anchor: beat ? 'beat' : 'first-scene', beat };
}

/**
 * Make the event's current approved invitation the episode's invitation
 * overlay: tag it, untag and supersede every other version, and (unless
 * place is false) remove other versions' placements on the episode and
 * place it on the invitation beat. No-op (returns tagged:false) when the
 * event has no approved invitation or no episode.
 */
async function syncEpisodeInvitationOverlay(models, { eventId, episodeId = null, place = true } = {}) {
  const result = { tagged: false, assetId: null, episodeId: null, overlayType: null, superseded: 0, removedPlacements: 0, placement: null, anchor: null };
  if (!models?.sequelize || !eventId) return result;
  const { sequelize } = models;

  const [event] = await sequelize.query(
    `SELECT e.id, e.show_id, e.used_in_episode_id, e.invitation_asset_id,
            a.id AS asset_id, a.show_id AS asset_show_id, a.approval_status
       FROM world_events e
       LEFT JOIN assets a ON a.id = e.invitation_asset_id AND a.deleted_at IS NULL
      WHERE e.id = :eventId
      LIMIT 1`,
    { replacements: { eventId }, type: sequelize.QueryTypes.SELECT }
  );
  const targetEpisodeId = episodeId || event?.used_in_episode_id || null;
  if (!event?.asset_id || event.approval_status !== 'approved' || !targetEpisodeId) return result;

  const assetId = event.asset_id;
  const overlayType = await resolveInvitationOverlayKey(sequelize, event.show_id || event.asset_show_id);

  await sequelize.query(
    `UPDATE assets
        SET episode_id = :episodeId,
            metadata = (COALESCE(metadata, '{}'::jsonb) - 'superseded_by' - 'superseded_at')
                       || jsonb_build_object('overlay_type', CAST(:overlayType AS text),
                                             'episode_invitation', true,
                                             'invitation_episode_id', CAST(:episodeId AS text)),
            updated_at = NOW()
      WHERE id = :assetId`,
    { replacements: { episodeId: targetEpisodeId, overlayType, assetId } }
  );

  // Every other version of this event's invitation: untag, and mark
  // superseded any that was tagged or approved. approval_status is left
  // as-is so the version history still shows what was approved.
  const [supersededRows] = await sequelize.query(
    `UPDATE assets
        SET metadata = (COALESCE(metadata, '{}'::jsonb) - 'overlay_type' - 'episode_invitation' - 'invitation_episode_id')
                       || jsonb_build_object('superseded_by', CAST(:assetId AS text), 'superseded_at', NOW()),
            updated_at = NOW()
      WHERE metadata->>'event_id' = :eventId
        AND asset_type = 'INVITATION_LETTER'
        AND id <> :assetId
        AND (metadata->>'overlay_type' IS NOT NULL
             OR metadata->>'episode_invitation' IS NOT NULL
             OR approval_status = 'approved')
      RETURNING id`,
    { replacements: { eventId: String(eventId), assetId } }
  );

  Object.assign(result, {
    tagged: true, assetId, episodeId: targetEpisodeId, overlayType,
    superseded: Array.isArray(supersededRows) ? supersededRows.length : 0,
  });
  if (!place || !models.TimelinePlacement) return result;

  // Only one invitation is placed on the episode: drop other versions'.
  try {
    const [others] = await sequelize.query(
      `SELECT id FROM assets
        WHERE metadata->>'event_id' = :eventId AND asset_type = 'INVITATION_LETTER' AND id <> :assetId`,
      { replacements: { eventId: String(eventId), assetId } }
    );
    const otherIds = (others || []).map((r) => r.id);
    if (otherIds.length > 0) {
      result.removedPlacements = await models.TimelinePlacement.destroy({
        where: { episode_id: targetEpisodeId, asset_id: otherIds },
      });
    }
  } catch (err) {
    console.warn('[episodeInvitationOverlay] removing superseded invitation placements failed:', err.message);
  }

  const placed = await placeInvitationOnBeat(models, { episodeId: targetEpisodeId, assetId });
  result.placement = placed.placement;
  result.anchor = placed.anchor;
  return result;
}

/**
 * The episode's own invitation overlay for the Lala's Phone listing:
 * the current approved invitation of the event that started this episode.
 * Other versions (pending, rejected, superseded) never match. Returns
 * null when there is none.
 */
async function loadEpisodeInvitationOverlay(sequelize, { showId, episodeId }) {
  if (!sequelize || !episodeId) return null;
  const rows = await sequelize.query(
    `SELECT a.id, a.name, a.s3_url_processed, a.s3_url_raw, a.episode_id,
            a.metadata::text AS metadata_text
       FROM world_events e
       JOIN assets a ON a.id = e.invitation_asset_id
      WHERE e.used_in_episode_id = :episodeId
        AND a.episode_id = :episodeId
        AND a.approval_status = 'approved'
        AND a.deleted_at IS NULL
        AND (e.show_id = :showId OR a.show_id = :showId)
      ORDER BY e.updated_at DESC
      LIMIT 1`,
    { replacements: { showId, episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  const row = rows?.[0];
  if (!row) return null;
  let metadata = {};
  try { metadata = row.metadata_text ? JSON.parse(row.metadata_text) : {}; } catch (err) {
    console.warn('[episodeInvitationOverlay] invitation metadata parse failed:', err.message);
  }
  return {
    id: row.id,
    name: row.name,
    metadata,
    overlay_type: metadata.overlay_type || DEFAULT_INVITATION_OVERLAY_KEY,
    url: row.s3_url_processed || row.s3_url_raw,
    episode_id: row.episode_id,
  };
}

/**
 * Put the episode's invitation into a GET /ui-overlays/:showId?episode_id=
 * status list: it fills the show's invitation overlay type entry (as that
 * episode's override), or is appended as its own entry when the show has
 * no invitation type. Pure; returns a new array.
 */
function mergeInvitationIntoOverlayStatus(status, invitation) {
  if (!invitation) return status;
  const fields = {
    generated: true,
    url: invitation.url || null,
    asset_id: invitation.id,
    bg_removed: false,
    custom_prompt: null,
    screen_links: null,
    image_fit: null,
    content_zones: null,
    is_episode_override: true,
    is_episode_invitation: true,
    variants: null,
  };
  const idx = status.findIndex((ot) => isInvitationOverlayType(ot.id, ot.name));
  if (idx >= 0) {
    return status.map((ot, i) => (i === idx ? { ...ot, ...fields } : ot));
  }
  return [...status, {
    id: invitation.overlay_type,
    name: 'Invitation',
    category: 'phone',
    beat: INVITATION_BEAT ? `Beat ${INVITATION_BEAT.number}` : '',
    description: 'This episode\'s approved invitation',
    prompt: null,
    sort_order: 100,
    lifecycle: 'per_episode',
    opens_screen: null,
    is_home: false,
    custom: false,
    ...fields,
  }];
}

module.exports = {
  INVITATION_BEAT,
  INVITATION_SCREEN_ACTION,
  DEFAULT_INVITATION_OVERLAY_KEY,
  isInvitationOverlayType,
  resolveInvitationOverlayKey,
  findInvitationBeat,
  placeInvitationOnBeat,
  syncEpisodeInvitationOverlay,
  loadEpisodeInvitationOverlay,
  mergeInvitationIntoOverlayStatus,
};
