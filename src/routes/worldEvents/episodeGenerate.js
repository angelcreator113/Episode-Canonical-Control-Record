/**
 * World Events routes — generating an episode from an event
 *
 * POST   /api/v1/world/:showId/events/:eventId/generate-episode
 * GET    /api/v1/world/:showId/events/:eventId/episode-locations
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { scriptOverwriteBlocked } = require('../../utils/scriptOverwriteGuard');
const { eventEpisodeConflictBody, EVENT_EPISODE_CONFLICT_CODE } = require('../../utils/eventEpisodeLink');
const { dealPriceRequiredBody, DEAL_PRICE_REQUIRED_CODE } = require('../../services/dealPricingService');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

// ═══════════════════════════════════════════════════════════════════════
// POST /world/:showId/events/:eventId/generate-episode
// Auto-generate a complete episode from an event
// ═══════════════════════════════════════════════════════════════════════

router.post('/world/:showId/events/:eventId/generate-episode', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    // Optional: when draft_script is true, also kick the script skeleton
    // generator so the new episode has a starting script. Otherwise the
    // creator gets the title + beat outline only and writes the script
    // themselves later.
    const draftScript = !!(req.body && req.body.draft_script);
    // Retry protection (services/startEpisodeIdempotency.js): an optional
    // Idempotency-Key header. A retry with the key of a Start that already
    // created this event's episode gets that episode back (200), not a 409.
    const { readIdempotencyKey, INVALID_KEY_CODE } = require('../../services/startEpisodeIdempotency');
    const idem = readIdempotencyKey(req.get('Idempotency-Key'));
    if (idem.error) return res.status(400).json({ success: false, error: idem.error, code: INVALID_KEY_CODE });
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load event — raw SQL, scoped to this show and to live rows. No
    // unscoped fallback (audit Medium, 2026-10-23): a failed read is a 500.
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // The chosen look's pieces for the money estimate, not the whole closet (Task #1919).
    const episodeGenerator = require('../../services/episodeGeneratorService');
    const wardrobeItems = await episodeGenerator.loadFinancialWardrobeItems(models.sequelize, showId, { event });
    const result = await episodeGenerator.generateEpisodeFromEvent(event, models, {
      showId,
      wardrobeItems,
      // L3 (Evoni, 2026-10-02): the locations confirmed in the Episode
      // Locations step; absent, the show's defaults and the event's set.
      locations: req.body?.locations,
      idempotencyKey: idem.key,
    });

    // The same Start, retried: its episode, as a fresh Start answers, with
    // 200 and nothing created or drafted again.
    if (result?.replayed) {
      return res.status(200).json({
        success: true,
        data: result,
        script_drafted: false,
        replayed: true,
        message: `Episode "${result.episode?.title || ''}" was already started by this request.`,
      });
    }

    // The event's seeds open as threads by themselves once they pass the
    // check (services/threadInbox; Evoni, 2026-10-26). Never awaited.
    require('../../services/threadInbox').openSeedsLater(models.sequelize, showId);

    // Optional: drop in a script skeleton right after the episode lands.
    // Reuses the same skeleton generator as POST /generate-script, just
    // inlined so the creator doesn't need a second click. Failures are
    // non-fatal — the episode is already saved.
    let scriptDrafted = false;
    if (draftScript && result?.episode?.id) {
      try {
        const scriptSkeletonGenerator = require('../../utils/scriptSkeletonGenerator');
        if (scriptSkeletonGenerator) {
          const skeleton = scriptSkeletonGenerator.generateScriptSkeleton(event, {
            includeNarration: true,
            includeAnimations: true,
          });
          if (skeleton && models.Episode) {
            const freshEpisode = await models.Episode.findByPk(result.episode.id);
            if (scriptOverwriteBlocked(freshEpisode?.script_content, req.body)) {
              console.warn(`[GenerateEpisode] Skipped script draft for episode ${result.episode.id}: existing script_content present, no confirmOverwrite flag.`);
            } else {
              const { scriptKeepingLocks } = require('../../utils/scriptBeatLocks');
              const nextScript = scriptKeepingLocks(freshEpisode, skeleton).script;
              // Version history (History audit H2): the replaced script is kept first.
              const { snapshotScript } = require('../../services/scriptVersions');
              await snapshotScript(models, freshEpisode, { source: 'generate', userId: req.user?.id, next: nextScript });
              await models.Episode.update(
                { script_content: nextScript },
                { where: { id: result.episode.id } }
              );
              scriptDrafted = true;
            }
          }
        }
      } catch (scriptErr) {
        console.warn('[generate-episode] Script draft failed (non-fatal):', scriptErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      data: result,
      script_drafted: scriptDrafted,
      message: `Episode "${result.episode.title}" created with ${result.scenePlan.length} beats, ${result.socialTasks.length} social tasks${scriptDrafted ? ' + draft script' : ''}`,
    });
  } catch (error) {
    if (error.code === EVENT_EPISODE_CONFLICT_CODE) {
      console.warn('Generate episode refused:', error.message);
      return res.status(409).json(eventEpisodeConflictBody(error.episode));
    }
    if (error.code === DEAL_PRICE_REQUIRED_CODE) {
      console.warn('Generate episode refused:', error.message);
      return res.status(409).json(dealPriceRequiredBody(error));
    }
    if (error instanceof require('../../services/episodeLocationsService').EpisodeLocationsError) {
      console.warn('Generate episode refused:', error.message);
      return res.status(error.status).json({ success: false, code: error.code, error: error.message });
    }
    // The stack is logged, never sent (audit Medium, 2026-10-23).
    console.error('Generate episode error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /world/:showId/events/:eventId/episode-locations — the Episode
// Locations step's starting point (L3, Q12; Evoni, 2026-10-02): home and
// closet from the show's defaults, the event's set, and the roles still to
// choose. Read-only.
router.get('/world/:showId/events/:eventId/episode-locations', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const event = await loadScopedEvent(models.sequelize, { showId, eventId, columns: 'id, show_id, scene_set_id, venue_look' });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const { proposeLocations } = require('../../services/episodeLocationsService');
    const { readVenueLook } = require('../../services/venueLookService');
    const { locationAngleGaps } = require('../../services/planLocationsService');
    const data = await proposeLocations(models.sequelize, { showId, event });
    // The event's look, shown read-only in the step (Q10), and the angles
    // the planner will ask for that the sets lack (L4, Q19).
    const angleGaps = await locationAngleGaps(models.sequelize, data.locations);
    return res.json({ success: true, data: { ...data, event_look: readVenueLook(event.venue_look), angle_gaps: angleGaps } });
  } catch (error) {
    console.error('Episode locations proposal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
