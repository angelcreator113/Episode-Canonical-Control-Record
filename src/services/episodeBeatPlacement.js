'use strict';

/**
 * Placing an episode overlay on one of the episode's canonical beats.
 *
 * Moved out of episodeInvitationOverlayService (P10, Task #2386) so the
 * invitation (beat 5) and the task-list overlay (P14, Task #2395, beat 9)
 * share one rule:
 *   - "the beat" is the episode's scene_plans row with that beat_number;
 *   - scenes rows carry no beat link, so a beat-anchored placement has
 *     scene_id null and records the beat in properties (anchor 'beat',
 *     beat_number, beat_name, scene_plan_id, screen_action) and its label
 *     ("<Label> — Beat N: Name");
 *   - only when the episode has no such scene_plans row does it fall back to
 *     the first-scene placement (placeOverlayOnFirstScene's default), marked
 *     anchor 'first-scene'; a later call moves it onto the beat;
 *   - idempotent: one placement per (episode, asset) — placeOverlayOnFirstScene's
 *     guard — and an existing placement not yet on the beat is moved onto it.
 */

const { placeOverlayOnFirstScene } = require('./timelinePlacementService');

/*
 * Off for now (Evoni, 2026-10-07: "none of the overlays should be beats for
 * now"): making an overlay (the invitation, the title overlay, the
 * task-list overlay) no longer places it on a beat or on the first scene;
 * the episode's Overlays tab lists what it has. Placements made before stay
 * as they are. setOverlaysOnBeats(true) turns placing back on (tests of the
 * rule use it).
 */
let overlaysOnBeats = false;
const setOverlaysOnBeats = (on) => { overlaysOnBeats = Boolean(on); };
const isOverlaysOnBeats = () => overlaysOnBeats;

/** The episode's scene_plans row for a canonical beat, or null. */
async function findEpisodeBeat(sequelize, episodeId, canonicalBeat, logTag = '[episodeBeatPlacement]') {
  if (!canonicalBeat || !episodeId) return null;
  try {
    const [rows] = await sequelize.query(
      `SELECT id, beat_number, beat_name FROM scene_plans
        WHERE episode_id = :episodeId AND beat_number = :beatNumber AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1`,
      { replacements: { episodeId, beatNumber: canonicalBeat.number } }
    );
    return rows?.[0] || null;
  } catch (err) {
    console.warn(`${logTag} beat ${canonicalBeat.number} lookup failed:`, err.message);
    return null;
  }
}

/**
 * Place (or move) an asset on the episode's canonical beat; first scene only
 * when the episode has no such beat.
 * @param {object} opts
 *   episodeId, assetId, canonicalBeat (a CANONICAL_BEATS entry),
 *   label ('Invitation'), kind, source, duration, zIndex, logTag
 * @returns {{ placement, anchor: 'beat'|'first-scene'|null, beat }} — all
 *   null while overlays are kept off beats (setOverlaysOnBeats).
 */
async function placeOverlayOnBeat(models, {
  episodeId, assetId, canonicalBeat, label, kind, source,
  duration = 5, zIndex = 20, logTag = '[episodeBeatPlacement]',
} = {}) {
  if (!overlaysOnBeats || !models?.TimelinePlacement || !episodeId || !assetId) return { placement: null, anchor: null, beat: null };
  const beat = await findEpisodeBeat(models.sequelize, episodeId, canonicalBeat, logTag);
  const base = { kind, source };
  let defaults;
  if (beat) {
    const beatName = beat.beat_name || canonicalBeat.name;
    defaults = {
      sceneId: null,
      duration,
      zIndex,
      label: `${label} — Beat ${beat.beat_number}: ${beatName}`,
      properties: {
        ...base,
        anchor: 'beat',
        beat_number: beat.beat_number,
        beat_name: beatName,
        scene_plan_id: beat.id,
        screen_action: canonicalBeat.screen_action,
      },
    };
  } else {
    defaults = { duration, zIndex, properties: { ...base, anchor: 'first-scene' } };
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
        console.warn(`${logTag} moving placement onto beat ${beat.beat_number} failed:`, err.message);
      }
    }
  }
  return { placement, anchor: beat ? 'beat' : 'first-scene', beat };
}

module.exports = { findEpisodeBeat, placeOverlayOnBeat, setOverlaysOnBeats, isOverlaysOnBeats };
