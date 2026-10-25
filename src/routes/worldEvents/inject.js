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

    // Insert into script
    let script = episode.script_content || '';

    // Remove existing [EVENT:] tag if present
    script = script.replace(/\[EVENT:[^\]]*\]/gi, '');
    script = script.replace(/\[LOCATION_HINT:[^\]]*\]/gi, '');

    // Find best insertion point (after STAKES_INTENTION beat or after first REVEAL)
    const stakesIdx = script.indexOf('## BEAT: STAKES');
    const revealIdx = script.indexOf('## BEAT: REVEAL');
    const interruptIdx = script.indexOf('## BEAT: INTERRUPTION');

    let insertIdx;
    if (stakesIdx >= 0) {
      insertIdx = script.indexOf('\n', stakesIdx) + 1;
    } else if (revealIdx >= 0) {
      insertIdx = script.indexOf('\n', revealIdx) + 1;
    } else if (interruptIdx >= 0) {
      insertIdx = script.indexOf('\n', interruptIdx) + 1;
    } else {
      // Insert at top
      insertIdx = 0;
    }

    const injection = eventTag + '\n' + (locationTag ? locationTag + '\n' : '');
    script = script.substring(0, insertIdx) + injection + script.substring(insertIdx);

    // F2 (Evoni, 2026-10-01): the required links (the script's tag, the
    // event's episode, its invitation's episode) commit together or not at
    // all. The scene-set link runs in a savepoint: if it can't be made, the
    // event is still attached and the response says the scene set needs
    // reconnecting, with POST .../scene-set-link to retry.
    const { linkEventSceneSet, STATUS } = require('../../services/eventSceneSetLinkService');
    const sceneSet = await models.sequelize.transaction(async (t) => {
      // Version history (services/scriptVersions.js; History audit H2,
      // 2026-10-24): the script before the event went in is kept first, in
      // a savepoint, so a failure to keep it never stops the injection.
      const { snapshotScript } = require('../../services/scriptVersions');
      await snapshotScript(models, episode, { source: 'generate', userId: req.user?.id, next: script.trim(), transaction: t });
      await episode.update({ script_content: script.trim() }, { transaction: t });
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
    const sceneSetLinked = sceneSet.status === STATUS.LINKED;

    return res.json({
      success: true,
      attached: true,
      event_tag: eventTag,
      location_tag: locationTag || null,
      scene_set: sceneSet,
      scene_set_linked: sceneSetLinked,
      episode_id,
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
