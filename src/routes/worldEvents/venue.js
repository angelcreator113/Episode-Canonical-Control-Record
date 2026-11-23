/**
 * World Events routes — venue brief, venue generation, social checklist
 *
 * POST   /api/v1/world/:showId/events/:eventId/venue-brief
 * POST   /api/v1/world/:showId/events/:eventId/generate-venue
 * POST   /api/v1/world/:showId/events/:eventId/generate-social-checklist
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth, authorize } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { isBudgetError } = require('../../services/imageCostService');
const { startedEpisodeFor } = require('../../services/episodeTaskCopyService');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

// The outcome of a picture that was generated and then not saved
// (sceneGenerationService.PlaceFinalizeRefusal carries the same word).
const GENERATED_NOT_SAVED = 'generated_not_saved';

// POST /world/:showId/events/:eventId/venue-brief — the Scene Briefs a venue
// generation would send (S2, S5), read-only: the interior (the set's base)
// and the exterior, for this event at its venue World Location, with the
// estimate for the two images. Body: { overrides? }.
router.post('/world/:showId/events/:eventId/venue-brief', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { readBriefOverrides, briefToPrompt } = require('../../services/sceneBriefService');
    const briefOverrides = readBriefOverrides(req.body?.overrides);
    if (briefOverrides.error) return res.status(400).json({ success: false, error: briefOverrides.error });
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const { prepareVenueBriefs, loadAttachedSet, attachedSetBaseBrief } = require('../../services/venueGenerationService');
    // A scene set already attached: its image is already available, or its
    // missing base is what a generation makes, from this brief and estimate.
    // A set that no longer exists reads as none: a new venue is made.
    const attached = await loadAttachedSet(models, event);
    if (attached) {
      const target = { event_id: event.id, scene_set_id: attached.id, scene_set_name: attached.name, world_location_id: attached.world_location_id || null };
      if (attached.base_still_url) {
        return res.json({
          success: true,
          data: { target: { kind: 'already_available', ...target, venue_image_url: attached.base_still_url }, brief: null, prompt: null, exterior_brief: null, exterior_prompt: null, estimate: null },
        });
      }
      const { brief, estimate: baseEstimate } = await attachedSetBaseBrief(models.sequelize, attached, event.id, { overrides: briefOverrides.value || {} });
      return res.json({
        success: true,
        data: { target: { kind: 'base', ...target }, brief, prompt: briefToPrompt(brief), exterior_brief: null, exterior_prompt: null, estimate: baseEstimate },
      });
    }
    const { draft, interior, exterior, estimate } = await prepareVenueBriefs(models.sequelize, event, { overrides: briefOverrides.value || {} });
    return res.json({
      success: true,
      data: {
        target: { kind: 'venue', event_id: event.id, scene_set_name: draft.name, world_location_id: draft.world_location_id },
        brief: interior,
        prompt: briefToPrompt(interior),
        exterior_brief: exterior,
        exterior_prompt: briefToPrompt(exterior),
        estimate,
      },
    });
  } catch (err) {
    console.error('[VenueGen] venue-brief error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-venue — Generate venue exterior + interior images
// Body: { force?: boolean, overrides? } — when `force` is true the endpoint makes
// a new venue even if the event already has a scene set attached. Otherwise an
// attached set is kept (a venue the user deliberately picked): its image is
// "already available", or its missing base is generated for this event from
// the brief venue-brief showed (S2, S3). A set that no longer exists reads as
// none. overrides: the "Your override" lines confirmed on the brief (S2, S5).
// The response's outcome says what happened: generated, already_available,
// failed, or generated_not_saved (409: the picture was made and stored, and
// the save was then refused; see the catch below).
//
// An ADMIN's (Evoni, 2026-11-22; P2b): it is paid, it stores images, and its
// new-venue branch moves the event to a new scene set. authorize sits before
// the rate limiter, so nothing below runs for anyone else.
//
// The Place lock (utils/placeLock, L13) holds here too (Evoni, 2026-11-22):
// on an event whose episode is accepted nothing is generated. A new venue,
// `force` or not, and the missing base of the set the event already has are
// both refused with the lock's 409, for an admin as for anyone, before the
// provider key is looked for and before anything is generated, stored,
// created or changed. Only "already available" is answered as before, on a
// locked event too: it generates and writes nothing.
router.post('/world/:showId/events/:eventId/generate-venue', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const force = req.body?.force === true;
    const { readBriefOverrides } = require('../../services/sceneBriefService');
    const briefOverrides = readBriefOverrides(req.body?.overrides);
    if (briefOverrides.error) return res.status(400).json({ success: false, error: briefOverrides.error });
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load event via raw SQL
    const [rows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // A scene set already attached is kept. Its image is already available,
    // or its missing base is generated now; a set that no longer exists reads
    // as none, and a new venue is generated and linked below.
    const { loadAttachedSet } = require('../../services/venueGenerationService');
    const attached = !force ? await loadAttachedSet(models, event) : null;
    if (attached?.base_still_url) {
      return res.json({
        success: true,
        skipped: true,
        outcome: 'already_available',
        data: { kind: 'base', scene_set_id: attached.id, venue_image_url: attached.base_still_url, venue_name: attached.name },
        message: `Venue images already available for "${event.name}": nothing generated`,
      });
    }

    // From here something is generated: the missing base of the attached
    // set, or a new venue the event is moved to. One check for both, with the
    // same lock and the same answer as the event edit's and the scene-set
    // link's.
    const { isPlaceLocked, PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = require('../../utils/placeLock');
    if (await isPlaceLocked(models.sequelize, event.id)) {
      return res.status(409).json({ success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE });
    }

    if (attached) {
      const sceneGenService = require('../../services/sceneGenerationService');
      // The base is saved through the Place finalizer (Generation B1): only
      // while the Place is still not locked and the event is still at this set.
      const { finalizePlaceWrite } = require('../../utils/placeLock');
      await sceneGenService.generateBaseScene(attached, models, {
        overrides: briefOverrides.value || {},
        eventId: event.id,
        finalize: (work) => finalizePlaceWrite(models.sequelize, event.id, { sourceSetId: attached.id, work }),
      });
      await attached.reload();
      if (!attached.base_still_url) throw new Error(`No base image was stored for "${attached.name}"`);
      return res.json({
        success: true,
        outcome: 'generated',
        data: { kind: 'base', scene_set_id: attached.id, venue_image_url: attached.base_still_url, venue_name: attached.name },
        message: `Venue image generated for "${attached.name}"`,
      });
    }

    // A new venue is made and the event is moved to it.
    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }
    if (!process.env.FAL_KEY) {
      return res.status(503).json({ success: false, error: 'FAL_KEY not configured. Add it to your .env file.' });
    }

    event.show_id = showId;

    const { generateVenueImages } = require('../../services/venueGenerationService');
    const result = await generateVenueImages(event, models, { overrides: briefOverrides.value || {} });

    return res.json({
      success: true,
      outcome: 'generated',
      data: { kind: 'venue', ...result },
      message: `Venue images generated for "${event.name}" — scene set created`,
    });
  } catch (err) {
    // Generated, stored, and then not saved (Generation B1): the Place
    // locked, the event's set changed, the event was deleted or every try
    // lost a lock wait while the picture was being made. Not a failure of
    // the generation, and never the 500 below: `code` and `error` are the
    // refusal's own (the Place lock's are the same as the early check's).
    if (err?.outcome === GENERATED_NOT_SAVED) {
      console.error(`[VenueGen] generated, not saved (${err.code}):`, err.message);
      return res.status(409).json({ success: false, outcome: GENERATED_NOT_SAVED, code: err.code, error: err.message, message: err.detail });
    }
    console.error('[VenueGen] Error:', err);
    return res.status(isBudgetError(err) ? 429 : 500).json({ success: false, outcome: 'failed', error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-social-checklist
router.post('/world/:showId/events/:eventId/generate-social-checklist', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const force = req.body?.force === true;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load event — raw SQL first (model may have unmigrated columns)
    let event;
    try {
      const [rows] = await models.sequelize.query(
        'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
        { replacements: { eventId, showId } }
      );
      event = rows?.[0];
    } catch {
      if (models.WorldEvent) {
        try {
          event = await models.WorldEvent.findByPk(eventId, { attributes: models.WorldEvent.CURRENT_ATTRIBUTES });
          if (event) event = event.toJSON();
        } catch { /* model query failed too */ }
      }
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Parse canon_consequences if string
    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }

    const socialChecklistService = require('../../services/socialChecklistService');
    // T5 (§8(bb); Task #2304): after Start Episode, the episode's copy.
    const episode = await startedEpisodeFor(models.sequelize, eventId);
    const result = await socialChecklistService.generateSocialChecklist(event, models, { forceRebuild: force, episode });

    const where = episode ? " on the episode's task list" : '';
    return res.json({
      success: true,
      data: result,
      message: `${force ? 'Social tasks regenerated' : 'Social checklist generated'} with ${result.tasks.length} tasks${where}`,
    });
  } catch (error) {
    console.error('Generate social checklist error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
