/**
 * World Events routes — linking an event to an episode
 *
 * POST   /api/v1/world/:showId/events/:eventId/inject
 * POST   /api/v1/world/:showId/events/:eventId/scene-set-link
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { findTermsLockEpisode, termsLockedBody, episodeLabel } = require('../../utils/eventTermsLock');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

const TAG_RE = /\[(?:EVENT|LOCATION_HINT):[^\]]*\]/i;
const HEADER_MARKERS = ['## BEAT: STAKES', '## BEAT: REVEAL', '## BEAT: INTERRUPTION'];

// A beat's label for a refusal: its header after "## BEAT:".
const beatLabel = (beat) => (String(beat.text).split('\n')[0].replace(/^\s*##\s*BEAT:\s*/i, '').trim() || `Beat ${beat.number}`);

/**
 * The episode's script with the event's tag lines in place (as it has
 * always been placed: the old [EVENT:] and [LOCATION_HINT:] tags removed,
 * the new ones after the first STAKES, REVEAL or INTERRUPTION header, else at
 * the top), or a refusal naming the approved beat it would change (A1c R1;
 * Evoni, 2026-10-27, D9 and P3). Never moved to another beat or to the top.
 */
function injectedScript(row, injection) {
  const { splitScriptBeats, normalizeLockedBeats } = require('../../utils/scriptBeatLocks');
  const { refuse } = require('../../services/scriptSave');
  const original = row.script_content || '';
  const locked = normalizeLockedBeats(row.script_locked_beats);
  const { beats } = splitScriptBeats(original);
  const blocked = (beat, reason, message) => refuse(409, 'INJECT_BLOCKED_BY_LOCK', message, { beat_number: beat ? beat.number : null, beat_label: beat ? beatLabel(beat) : null, reason });

  if (locked.length && !beats.length) {
    blocked(null, 'headerless_locked', 'This script has no beat headers and has an approved beat, so the event tag can\'t be placed without changing approved text. Add the tag by hand.');
  }
  for (const beat of beats) {
    if (locked.includes(beat.number) && TAG_RE.test(beat.text)) {
      blocked(beat, 'old_tag_in_locked_beat', `Beat ${beat.number} · ${beatLabel(beat)} is approved and holds this episode's event tag. Unlock it to change the event, or edit the tag by hand.`);
    }
  }

  let script = original.replace(/\[EVENT:[^\]]*\]/gi, '').replace(/\[LOCATION_HINT:[^\]]*\]/gi, '');
  const marker = HEADER_MARKERS.find((m) => script.indexOf(m) >= 0);
  if (marker) {
    const target = beats.find((b) => String(b.text).split('\n')[0].includes(marker));
    if (target && locked.includes(target.number)) {
      blocked(target, 'intended_beat_locked', `Beat ${target.number} · ${beatLabel(target)} is approved, and that is where this event's tag goes. Unlock it to place the event, or add the tag by hand.`);
    }
  }
  const at = marker ? script.indexOf('\n', script.indexOf(marker)) + 1 : 0;
  script = script.substring(0, at) + injection + script.substring(at);
  return script.trim();
}

// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/inject
// Inject an event into an episode's script as [EVENT:] tag
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/inject', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { episode_id } = req.body;

    if (!episode_id) return res.status(400).json({ success: false, error: 'episode_id is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Get event
    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId`,
      { replacements: { eventId, showId } }
    );

    if (!events || events.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = events[0];

    // Get episode
    const episode = await models.Episode.findByPk(episode_id);
    if (!episode) return res.status(404).json({ success: false, error: 'Episode not found' });

    // Terms lock (§8(x) D4; Task #2230): an event that started a live
    // episode is never moved to another one. Injecting into the same
    // episode again is allowed.
    const lockEpisode = await findTermsLockEpisode(models.sequelize, eventId);
    if (lockEpisode && String(lockEpisode.id) !== String(episode_id)) {
      return res.status(409).json(termsLockedBody(lockEpisode, ['used_in_episode_id'],
        `This event started ${episodeLabel(lockEpisode)}, so it can't be moved to another episode. Its terms and episode link are locked.`));
    }

    // Build [EVENT:] tag
    const parts = [`name="${event.name}"`];
    if (event.prestige) parts.push(`prestige=${event.prestige}`);
    if (event.cost_coins) parts.push(`cost=${event.cost_coins}`);
    if (event.strictness) parts.push(`strictness=${event.strictness}`);
    if (event.deadline_type) parts.push(`deadline="${event.deadline_type}"`);
    if (event.dress_code) parts.push(`dress_code="${event.dress_code}"`);
    const eventTag = `[EVENT: ${parts.join(' ')}]`;

    // Build location hint if present
    const locationTag = event.location_hint ? `[LOCATION_HINT: "${event.location_hint}"]` : '';

    const injection = eventTag + '\n' + (locationTag ? locationTag + '\n' : '');

    // F2 (Evoni, 2026-10-01): the required links (the script's tag, the
    // event's episode, its invitation's episode) commit together or not at
    // all. The scene-set link runs in a savepoint: if it can't be made, the
    // event is still attached and the response says the scene set needs
    // reconnecting, with POST .../scene-set-link to retry.
    // The script (A1c R1, services/scriptSave.js): built from the episode
    // as it is now, its row locked in this transaction; the script it
    // replaces kept as a version, a failure failing the injection. Locked
    // beats are never edited (D9, P3): the tag goes where it always has (the
    // first STAKES, REVEAL or INTERRUPTION beat, else the top), and is refused,
    // naming the beat, when that beat is approved, when the old tag is in an
    // approved beat, or when a script with no beat headers has a lock.
    const { linkEventSceneSet, STATUS } = require('../../services/eventSceneSetLinkService');
    const { saveEpisodeScript, sendScriptSaveError } = require('../../services/scriptSave');
    let sceneSet;
    let saved;
    try {
      sceneSet = await models.sequelize.transaction(async (t) => {
        saved = await saveEpisodeScript(models, episode_id, {
          writer: 'W5',
          source: 'generate',
          userId: req.user?.id,
          transaction: t,
          compose: (row) => ({ script: injectedScript(row, injection) }),
        });
        await models.sequelize.query(
          `UPDATE world_events SET used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, status = 'used', updated_at = NOW() WHERE id = :eventId`,
          { replacements: { episodeId: episode_id, eventId }, transaction: t }
        );
        // If this event has an approved invitation, stamp the episode_id on the asset
        if (event.invitation_asset_id) {
          await models.sequelize.query(
            `UPDATE assets SET episode_id = :episodeId, updated_at = NOW()
             WHERE id = :assetId AND deleted_at IS NULL`,
            { replacements: { episodeId: episode_id, assetId: event.invitation_asset_id }, transaction: t }
          );
        }
        return linkEventSceneSet(models.sequelize, { event, episodeId: episode_id, transaction: t });
      });
    } catch (err) {
      if (sendScriptSaveError(res, err)) return undefined;
      throw err;
    }
    const sceneSetLinked = sceneSet.status === STATUS.LINKED;

    return res.json({
      success: true,
      attached: true,
      event_tag: eventTag,
      location_tag: locationTag || null,
      scene_set: sceneSet,
      scene_set_linked: sceneSetLinked,
      episode_id,
      script_revision: saved.script_revision,
      message: `Event "${event.name}" injected into episode script.${sceneSetLinked ? ' Scene set auto-linked.' : ''}${sceneSet.status === STATUS.NEEDS_RECONNECTING ? ' Scene set needs reconnecting.' : ''}${sceneSet.status === STATUS.CHOOSE ? ' Choose its scene set.' : ''}`,
    });
  } catch (error) {
    console.error('Inject event error:', error);
    return res.status(500).json({ success: false, error: 'Failed to inject event', message: error.message });
  }
});

// POST /api/v1/world/:showId/events/:eventId/scene-set-link — Retry linking
// an attached event's scene set to its episode (F2), or link the one Evoni
// chose (F3): body { scene_set_id? }. 409 when the event is not attached to
// an episode. The response's scene_set says what happened.
router.post('/world/:showId/events/:eventId/scene-set-link', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (!event.used_in_episode_id) {
      return res.status(409).json({ success: false, code: 'EVENT_NOT_ATTACHED', error: 'This event is not attached to an episode.' });
    }
    const { linkEventSceneSet } = require('../../services/eventSceneSetLinkService');
    const chosenSceneSetId = req.body?.scene_set_id || null;
    if (chosenSceneSetId && typeof chosenSceneSetId !== 'string') {
      return res.status(400).json({ success: false, error: 'scene_set_id must be a string' });
    }
    // A chosen set changes the event's Place: locked once its episode is
    // accepted, of this show or shared, and not another event's version
    // (eighth audit: this route skipped all three).
    if (chosenSceneSetId && String(chosenSceneSetId) !== String(event.scene_set_id || '')) {
      const { isPlaceLocked, PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = require('../../utils/placeLock');
      if (await isPlaceLocked(models.sequelize, event.id)) {
        return res.status(409).json({ success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE });
      }
      const refusal = await require('../../services/eventPlaceSync').refuseEventSet(models.sequelize, { event, setId: chosenSceneSetId, showId });
      // A set that does not exist is answered by the link itself (needs reconnecting).
      if (refusal && refusal.code !== 'INVALID_SCENE_SET_ID') return res.status(refusal.status).json({ success: false, code: refusal.code, error: refusal.error });
    }
    const sceneSet = await models.sequelize.transaction((t) => linkEventSceneSet(models.sequelize, {
      event, episodeId: event.used_in_episode_id, transaction: t, chosenSceneSetId,
    }));
    return res.json({ success: true, episode_id: event.used_in_episode_id, scene_set: sceneSet });
  } catch (error) {
    console.error('Scene set link error:', error);
    return res.status(500).json({ success: false, error: 'Failed to link the scene set', message: error.message });
  }
});

module.exports = router;
