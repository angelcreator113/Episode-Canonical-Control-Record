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
const { lockLiveEvent, eventDeletedBody, EVENT_DELETED_CODE } = require('../../utils/eventEpisodeLink');
const { getModels } = require('./helpers');
const { findFrozenDeletedEpisode, restartRefusal, isFrozenEpisodeError } = require('../../utils/frozenEpisode');

const TAG_RE = /\[(?:EVENT|LOCATION_HINT):[^\]]*\]/i;
const HEADER_LINE_RE = /^\s*##\s*BEAT:\s*(.*)$/i;
// The beat an event's tag goes in, in order of preference: the strategic
// reaction (STAKES_INTENTION, canonical beat 6), else the reveal (5), else
// the first interruption (4, then 7). The same preference as the old
// "## BEAT: STAKES / REVEAL / INTERRUPTION" markers, read from the beat's
// canonical number so a numbered header (`## BEAT: 6 · Strategic Reaction`)
// and a named one (`## BEAT: STAKES_INTENTION`) both count (A1c R1; Evoni,
// 2026-10-27, N6).
const INTENDED_BEATS = [6, 5, 4, 7];
// A named header the old markers matched by its start ("## BEAT: STAKES",
// "## BEAT: REVEAL - the invite", "## BEAT: INTERRUPTION 2"), when its name
// is not a canonical one (utils/beatLabelNumber.js reads those).
function markerBeat(label) {
  const text = String(label || '').trim().toUpperCase();
  if (/^STAKES\b/.test(text)) return 6;
  if (/^REVEAL\b/.test(text)) return 5;
  if (/^INTERRUPTION\b/.test(text)) return /\b2\b|#\s*2|II\b/.test(text.slice('INTERRUPTION'.length)) ? 7 : 4;
  return null;
}

// A beat's label for a refusal: its header after "## BEAT:".
const beatLabel = (beat) => (String(beat.text).split('\n')[0].replace(/^\s*##\s*BEAT:\s*/i, '').trim() || `Beat ${beat.number}`);
// "Beat 6 · Strategic Reaction", from a label with or without its number.
const beatName = (number, label) => {
  const name = String(label || '').replace(/^\d{1,2}\b\s*[·.:\-–—]?\s*/, '').trim();
  return name ? `Beat ${number} · ${name}` : `Beat ${number}`;
};

/**
 * The episode's script with the event's tag lines in its intended beat (the
 * old [EVENT:] and [LOCATION_HINT:] tags removed, the new ones on the lines
 * after that beat's header), or a refusal (A1c R1; Evoni, 2026-10-27, D9, P3
 * and N6): the tag is never put in another beat or at the top.
 *   INJECT_BLOCKED_BY_LOCK: the intended beat is approved, or an old tag is in
 *     an approved beat (it would be removed);
 *   INJECT_NO_INTENDED_BEAT: the script has no beat headers, or none of the
 *     beats a tag goes in. A header is that beat only by its
 *     number, its canonical name, or the old markers' names (STAKES, REVEAL,
 *     INTERRUPTION), never by its place.
 */
function injectedScript(row, injection) {
  const { splitScriptBeats, normalizeLockedBeats } = require('../../utils/scriptBeatLocks');
  const { headerNumber, normalizeBeatHeaders } = require('../../utils/beatLabelNumber');
  const { refuse } = require('../../services/scriptSave');
  const original = typeof row.script_content === 'string' ? row.script_content : '';
  const locked = normalizeLockedBeats(row.script_locked_beats);
  const blocked = (number, label, reason, message) => refuse(409, 'INJECT_BLOCKED_BY_LOCK', message, { beat_number: number, beat_label: label, reason });
  const missing = (reason, message) => refuse(409, 'INJECT_NO_INTENDED_BEAT', message, { beat_number: null, beat_label: null, reason, intended_beats: INTENDED_BEATS });

  // An empty script has no beat to put the tag in and nothing to displace:
  // null, and the event is attached with no tag (Evoni, 2026-10-27).
  if (!original.trim()) return null;
  for (const beat of splitScriptBeats(original).beats) {
    if (locked.includes(beat.number) && TAG_RE.test(beat.text)) {
      blocked(beat.number, beatLabel(beat), 'old_tag_in_locked_beat', `${beatName(beat.number, beatLabel(beat))} is approved and holds this episode's event tag. Unlock it to change the event, or edit the tag by hand.`);
    }
  }

  const lines = original.replace(/\[EVENT:[^\]]*\]/gi, '').replace(/\[LOCATION_HINT:[^\]]*\]/gi, '').split('\n');
  const headers = [];
  lines.forEach((line, index) => {
    // A Windows line end is read past here; the script keeps its own line ends.
    const m = normalizeBeatHeaders(line.replace(/\r$/, '')).match(HEADER_LINE_RE);
    // number: the beat as locks count it (its header's number or canonical
    // name, else its place, as splitScriptBeats); beat: the canonical beat it
    // is, from its number or name only, never from its place.
    if (m) {
      const named = headerNumber(m[1]);
      headers.push({ index, number: named || headers.length + 1, beat: named || markerBeat(m[1]), label: m[1].trim() });
    }
  });
  if (!headers.length) {
    missing('no_beat_headers', 'This script has no beat headers, so the event tag has no beat to go in. Add the beat headers (Beat view does), then attach the event, or add the tag by hand.');
  }
  let target = null;
  for (const n of INTENDED_BEATS) {
    target = headers.find((h) => h.beat === n);
    if (target) break;
  }
  if (!target) {
    missing('no_intended_beat', 'This script has none of the beats an event tag goes in (Strategic Reaction, Reveal or an Interruption, beats 6, 5, 4 or 7). Add one of them, then attach the event, or add the tag by hand.');
  }
  if (locked.includes(target.number)) {
    blocked(target.number, target.label || `Beat ${target.number}`, 'intended_beat_locked', `${beatName(target.number, target.label)} is approved, and that is where this event's tag goes. Unlock it to place the event, or add the tag by hand.`);
  }
  const tagLines = String(injection).replace(/\n$/, '').split('\n');
  lines.splice(target.index + 1, 0, ...tagLines);
  return lines.join('\n').trim();
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
      `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL`,
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

    // Inject attaches an episode's event and rewrites its script's one event
    // tag, so it is for a first event or the primary only (Evoni, 2026-11-12):
    // a second event for an episode that has one is linked from the episode's
    // Events, not injected. Refused before anything is written.
    {
      const secondaryEvents = require('../../services/episodeSecondaryEvents');
      const link = await secondaryEvents.classifyLink(models.sequelize, { eventId, episodeId: episode_id });
      // A filmed episode is refused below as filmed (its script is never
      // changed by a generator): that answer comes first and is kept.
      const filmedAlready = link.kind === 'secondary' ? await require('../../utils/frozenEpisode').filmedAt(models.sequelize, episode_id) : null;
      if (link.kind === 'secondary' && !filmedAlready) {
        const refusal = secondaryEvents.attachEnabled()
          ? new secondaryEvents.SecondaryEventError(409, secondaryEvents.CODES.INJECT_UNSUPPORTED,
            'This episode already has its event. A second event is linked from the episode\'s Events, not injected: injecting would replace the script\'s event tag. Nothing was changed.',
            { episode_id: episode_id, event_id: eventId })
          : new secondaryEvents.SecondaryEventError(409, secondaryEvents.CODES.NOT_ENABLED,
            'This episode already has its event, and linking a second event to an episode is not switched on yet. Nothing was changed.');
        console.warn(`[inject] refused (${refusal.code}):`, refusal.message);
        return res.status(refusal.status).json(refusal.toJSON());
      }
    }

    // A1.2c (Q-7 Layer 2): the event of a filmed episode that was deleted
    // is never attached to another episode. Asked again under the event lock below.
    const frozenDeleted = await findFrozenDeletedEpisode(models.sequelize, eventId);
    if (frozenDeleted) {
      const refusal = restartRefusal(eventId, frozenDeleted);
      console.warn(`[inject] refused (${refusal.code}):`, refusal.message);
      return res.status(409).json(refusal.toJSON());
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
    // beats are never edited (D9, P3), and the tag stays in its intended beat
    // (N6; injectedScript above): refused, naming the beat, when that beat is
    // approved or the old tag is in an approved beat, and refused when the
    // script has no intended beat. Nothing is linked when it is refused.
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
          compose: (row) => {
            const script = injectedScript(row, injection);
            // An empty script stays as it is (nothing is written); the event is still attached.
            return script === null ? { script: typeof row.script_content === 'string' ? row.script_content : '', extra: { tagged: false } } : { script, extra: { tagged: true } };
          },
        });
        // A1.2c: the event row locked (after the episode's, episode-first), then asked again.
        // The same lock a delete takes: an event deleted meanwhile is refused (EVENT_DELETED), nothing linked.
        await lockLiveEvent(models.sequelize, eventId, { transaction: t });
        const frozenNow = await findFrozenDeletedEpisode(models.sequelize, eventId, { transaction: t });
        if (frozenNow) throw restartRefusal(eventId, frozenNow);
        // Asked again under the episode and event locks: another event
        // linked meanwhile makes this a second event, which is not injected.
        {
          const secondaryEvents = require('../../services/episodeSecondaryEvents');
          const linkNow = await secondaryEvents.classifyLink(models.sequelize, { eventId, episodeId: episode_id, transaction: t });
          if (linkNow.kind === 'secondary') {
            throw new secondaryEvents.SecondaryEventError(409, secondaryEvents.CODES.INJECT_UNSUPPORTED,
              'Another event was linked to this episode while this one was being injected. A second event is not injected. Nothing was changed.',
              { episode_id, event_id: eventId });
          }
        }
        await models.sequelize.query(
          `UPDATE world_events SET used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, status = 'used', updated_at = NOW() WHERE id = :eventId AND deleted_at IS NULL`,
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
      if (require('../../services/episodeSecondaryEvents').isSecondaryEventError(err)) {
        console.warn(`[inject] refused (${err.code}):`, err.message);
        return res.status(err.status).json(err.toJSON());
      }
      if (isFrozenEpisodeError(err)) {
        console.warn(`[inject] refused (${err.code}):`, err.message);
        return res.status(409).json(err.toJSON());
      }
      if (err.code === EVENT_DELETED_CODE) {
        console.warn(`[inject] refused (${err.code}):`, err.message);
        return res.status(409).json(eventDeletedBody(err));
      }
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
      // false when the episode had no script yet: the event is attached, its tag not placed.
      script_tagged: saved.extra?.tagged !== false,
      script_revision: saved.script_revision,
      message: `${saved.extra?.tagged === false ? `Event "${event.name}" attached. The episode has no script yet, so its tag was not added; generate or write the script, then attach the event again to add it.` : `Event "${event.name}" injected into episode script.`}${sceneSetLinked ? ' Scene set auto-linked.' : ''}${sceneSet.status === STATUS.NEEDS_RECONNECTING ? ' Scene set needs reconnecting.' : ''}${sceneSet.status === STATUS.CHOOSE ? ' Choose its scene set.' : ''}`,
    });
  } catch (error) {
    // The episode's one link is held by another event (the database allows
    // one for now): the inject rolled back whole. Said as that, with the
    // event that holds it, so the link can be repaired; not a 500.
    const { isEpisodeEventLinkConflict, episodeEventLinkTakenBody, findEpisodeLinkHolder } = require('../../utils/eventEpisodeLink');
    if (isEpisodeEventLinkConflict(error)) {
      const models = await getModels();
      const holder = await findEpisodeLinkHolder(models.sequelize, req.body?.episode_id, req.params.eventId);
      console.warn('[inject] refused (EPISODE_EVENT_LINK_TAKEN): the episode\'s link is held by another event');
      return res.status(409).json(episodeEventLinkTakenBody({ episodeId: req.body?.episode_id || null, holder }));
    }
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

// POST /world/:showId/events/:eventId/detach-episode
//
// Remove a second event from its episode, before filming (Evoni, 2026-11-12;
// services/episodeSecondaryEvents.detachSecondaryEvent). Body: { reason }.
// One transaction; a repeat is a no-op (200, detached: false); refused with
// what blocks it (409) for the primary event, a filmed episode, reopened
// terms, any commitment, or anything in production that still depends on
// it. Every outcome is written to the activity log. Not gated by the attach
// switch: removing is always allowed where it is safe.
router.post('/world/:showId/events/:eventId/detach-episode', requireAuth, async (req, res) => {
  const secondaryEvents = require('../../services/episodeSecondaryEvents');
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const result = await secondaryEvents.detachSecondaryEvent(models.sequelize, models, {
      eventId, showId, userId: req.user?.id ?? null, reason: req.body?.reason,
    });
    return res.json(result);
  } catch (err) {
    if (secondaryEvents.isSecondaryEventError(err)) {
      console.warn(`[detach-episode] refused (${err.code}):`, err.message);
      return res.status(err.status).json(err.toJSON());
    }
    // Deleted while the detach waited for it: nothing was changed.
    if (err.code === EVENT_DELETED_CODE) {
      console.warn('[detach-episode] refused:', err.message);
      return res.status(409).json(eventDeletedBody(err));
    }
    const { asRetryable, RetryableConflictError } = require('../../utils/episodeLocks');
    const retry = asRetryable(err);
    if (retry instanceof RetryableConflictError) {
      console.warn(`[detach-episode] refused (${retry.code}):`, retry.message);
      return res.status(409).json({ success: false, error: retry.message, code: retry.code });
    }
    console.error('[detach-episode] failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
// For tests/unit/routes/injectPlacement.test.js.
module.exports.injectedScript = injectedScript;
module.exports.INTENDED_BEATS = INTENDED_BEATS;
