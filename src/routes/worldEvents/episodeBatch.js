/**
 * World Events routes — episodes from many events, regenerate, bulk delete
 *
 * POST   /api/v1/world/:showId/events/generate-episode-from-many
 * POST   /api/v1/world/:showId/events/:eventId/regenerate-episode
 * POST   /api/v1/world/:showId/events/bulk-delete
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { eventEpisodeConflictBody, EVENT_EPISODE_CONFLICT_CODE } = require('../../utils/eventEpisodeLink');
const { findMissingPrices, dealPriceRequiredError, dealPriceRequiredBody, DEAL_PRICE_REQUIRED_CODE } = require('../../services/dealPricingService');
const { takePriceSnapshot } = require('../../services/dealPriceSnapshot');
const { getModels } = require('./helpers');

// POST /world/:showId/events/generate-episode-from-many
//
// Generate a single episode from multiple events. The first event in the
// list is the "anchor" — it drives title generation, outfit, and brief
// fields the way the single-event generator does. The remaining events
// are linked to the same episode via used_in_episode_id, so their
// locations, dress codes, narrative stakes, and outfits all show on the
// episode page through the existing read-through patterns.
//
// Body: { event_ids: [uuid, ...], draft_script?: bool }
router.post('/world/:showId/events/generate-episode-from-many', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId } = req.params;
    const { event_ids: eventIds = [], draft_script: draftScript = false } = req.body || {};
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ success: false, error: 'event_ids array required' });
    }
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load every requested event in one query so we can validate up front.
    const [rows] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE show_id = :showId AND id IN (:eventIds)`,
      { replacements: { showId, eventIds } }
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching events found' });
    }
    const eventsById = new Map(rows.map(r => [r.id, r]));
    // Order the events list to match the input order so the first ID is
    // the anchor regardless of DB return order.
    const ordered = eventIds.map(id => eventsById.get(id)).filter(Boolean);
    const anchor = ordered[0];
    const extras = ordered.slice(1);

    // Anchor must not already have a live episode. generateEpisodeFromEvent
    // enforces that (Task #1751) and the catch below maps its refusal to
    // 409; a link to a deleted episode does not block. Extras that are
    // already linked to other episodes are skipped with a warning.

    // The extras' terms lock with the episode too, so each deal's price must
    // be complete first (Deal PR 3 ruling, point 6; Task #2341). The anchor
    // is checked inside generateEpisodeFromEvent.
    const extrasMissing = [];
    for (const ev of extras) {
      if (ev.used_in_episode_id) continue;
      const missing = await findMissingPrices(models.sequelize, ev.id);
      extrasMissing.push(...missing.map((m) => ({ ...m, event_id: ev.id, label: `${ev.name}: ${m.label}` })));
    }
    if (extrasMissing.length) {
      const refusal = dealPriceRequiredError(extrasMissing);
      console.warn('Multi-event generate refused:', refusal.message);
      return res.status(409).json(dealPriceRequiredBody(refusal));
    }

    const episodeGenerator = require('../../services/episodeGeneratorService');
    const wardrobeItems = await episodeGenerator.loadFinancialWardrobeItems(models.sequelize, showId, { event: anchor });
    const result = await episodeGenerator.generateEpisodeFromEvent(anchor, models, { showId, wardrobeItems });
    const newEpisodeId = result?.episode?.id;

    // Link the extra events to the same episode. Skip ones that already
    // link somewhere (they'd violate the partial unique index anyway).
    const linkedExtras = [];
    const skippedExtras = [];
    for (const ev of extras) {
      if (ev.used_in_episode_id) {
        skippedExtras.push({ id: ev.id, name: ev.name, reason: 'already linked elsewhere' });
        continue;
      }
      try {
        // Linked, its terms lock: the link and its frozen prices commit
        // together (services/dealPriceSnapshot).
        await models.sequelize.transaction(async (transaction) => {
          await models.sequelize.query(
            `UPDATE world_events SET used_in_episode_id = :episodeId, status = 'used', updated_at = NOW() WHERE id = :evId`,
            { replacements: { episodeId: newEpisodeId, evId: ev.id }, transaction }
          );
          await takePriceSnapshot(models.sequelize, ev.id, { transaction, reason: 'linked_episode' });
        });
        linkedExtras.push({ id: ev.id, name: ev.name });
      } catch (linkErr) {
        skippedExtras.push({ id: ev.id, name: ev.name, reason: linkErr.message });
      }
    }

    let scriptDrafted = false;
    let scriptRevision = null;
    if (draftScript && newEpisodeId) {
      try {
        const scriptSkeletonGenerator = require('../../utils/scriptSkeletonGenerator');
        if (scriptSkeletonGenerator) {
          const skeleton = scriptSkeletonGenerator.generateScriptSkeleton(anchor, {
            includeNarration: true,
            includeAnimations: true,
          });
          if (skeleton && models.Episode) {
            // Through services/scriptSave.js (A1c R1): the row locked, an
            // existing script left as it is unless confirmOverwrite, checked
            // under the lock; locked beats kept; the replaced script kept as
            // a version.
            const { saveEpisodeScript } = require('../../services/scriptSave');
            const { scriptKeepingLocks } = require('../../utils/scriptBeatLocks');
            const saved = await saveEpisodeScript(models, newEpisodeId, {
              writer: 'W8',
              source: 'generate',
              skipIfScript: req.body?.confirmOverwrite !== true,
              userId: req.user?.id,
              compose: (row) => ({ script: scriptKeepingLocks(row, skeleton).script }),
            });
            if (saved.skipped) {
              console.warn(`[generate-from-many] Skipped script draft for episode ${newEpisodeId}: existing script_content present, no confirmOverwrite flag.`);
            } else {
              scriptDrafted = true;
              scriptRevision = saved.script_revision;
            }
          }
        }
      } catch (scriptErr) {
        console.warn('[generate-from-many] Script draft failed (non-fatal):', scriptErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      data: result,
      anchor_event_id: anchor.id,
      linked_extras: linkedExtras,
      skipped_extras: skippedExtras,
      script_drafted: scriptDrafted,
      ...(scriptRevision ? { script_revision: scriptRevision } : {}),
      message: `Episode "${result.episode.title}" created from ${1 + linkedExtras.length} event${linkedExtras.length === 0 ? '' : 's'}${skippedExtras.length ? ` (${skippedExtras.length} skipped)` : ''}`,
    });
  } catch (error) {
    if (error.code === EVENT_EPISODE_CONFLICT_CODE) {
      console.warn('Multi-event generate refused:', error.message);
      return res.status(409).json(eventEpisodeConflictBody(error.episode));
    }
    if (error.code === DEAL_PRICE_REQUIRED_CODE) {
      console.warn('Multi-event generate refused:', error.message);
      return res.status(409).json(dealPriceRequiredBody(error));
    }
    console.error('Multi-event generate error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /world/:showId/events/:eventId/regenerate-episode
//
// Replace the existing episode generated from this event with a fresh one.
// Same generator service, told which episode it is replacing: the new
// episode is created first, and the old one is soft-deleted and the event
// relinked in the same transaction (§8(w) P3). Useful when the event has been edited (new outfit,
// stakes, etc.) and the creator wants the episode to reflect those
// changes without losing their place.
router.post('/world/:showId/events/:eventId/regenerate-episode', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Look up the previously-generated episode_id, if any.
    const [evRows] = await models.sequelize.query(
      'SELECT id, used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = evRows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // The previous episode stays live and linked until its replacement
    // exists: the generator supersedes it (soft-delete) and relinks the event
    // in the same transaction that creates the new episode, so a failure
    // leaves both as they were (§8(w) P3, Task #2210). Its briefs, wardrobe
    // and scene plan are not cascade-deleted, as before.
    const oldEpisodeId = event.used_in_episode_id || null;

    // Re-fetch the event row in full so the generator gets every column.
    const [fullRows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const fullEvent = fullRows?.[0];

    let wardrobeItems = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT id, name, coin_cost, price, acquisition_type FROM wardrobe WHERE show_id = :showId AND deleted_at IS NULL`,
        { replacements: { showId } }
      );
      wardrobeItems = rows || [];
    } catch { /* wardrobe may not exist yet */ }

    const episodeGenerator = require('../../services/episodeGeneratorService');
    const result = await episodeGenerator.generateEpisodeFromEvent(fullEvent, models, { showId, wardrobeItems, replacingEpisodeId: oldEpisodeId });

    return res.status(201).json({
      success: true,
      data: result,
      replaced_episode_id: oldEpisodeId,
      message: `Episode regenerated. Previous episode${oldEpisodeId ? ' soft-deleted' : ' did not exist'}.`,
    });
  } catch (error) {
    if (error.code === EVENT_EPISODE_CONFLICT_CODE) {
      console.warn('Regenerate episode refused:', error.message);
      return res.status(409).json(eventEpisodeConflictBody(error.episode));
    }
    console.error('Regenerate episode error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /world/:showId/events/bulk-delete — Delete multiple events at once
router.post('/world/:showId/events/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { ids, delete_all_drafts, delete_all } = req.body;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    let deleted = 0;
    if (delete_all) {
      // Delete ALL events for this show
      const [result] = await models.sequelize.query(
        'DELETE FROM world_events WHERE show_id = :showId',
        { replacements: { showId } }
      );
      deleted = result?.rowCount || 0;
    } else if (delete_all_drafts) {
      // Delete all draft events
      const [result] = await models.sequelize.query(
        "DELETE FROM world_events WHERE show_id = :showId AND status = 'draft'",
        { replacements: { showId } }
      );
      deleted = result?.rowCount || 0;
    } else if (ids && Array.isArray(ids)) {
      // Delete specific IDs
      for (const id of ids) {
        try {
          await models.sequelize.query(
            'DELETE FROM world_events WHERE id = :id AND show_id = :showId',
            { replacements: { id, showId } }
          );
          deleted++;
        } catch { /* skip */ }
      }
    }

    return res.json({ success: true, deleted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
