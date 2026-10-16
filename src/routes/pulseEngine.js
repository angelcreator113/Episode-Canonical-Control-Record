'use strict';
/**
 * The Pulse's posting engine settings and queue (Task #2968; The Pulse spec
 * §7 "Cost control"; services/pulseQueue.js). Mounted at /api/v1/pulse-engine.
 *
 *   GET /?show_id=   the daily request limits (automated, manual) and
 *                    ambient switch, requests taken today by lane
 *                    (services/pulseRequests.js), drafts made today,
 *                    whether the worker runs on this server, and the last
 *                    jobs (requireAuth)
 *   PUT /            { show_id, automated_requests?, manual_requests?,
 *                    ambient_enabled? } (requireAuth + ADMIN)
 *   POST /episodes/:episodeId/queue  { show_id } queues a completed
 *                    episode's event posts that were never queued (the
 *                    engine was off, or the cap skipped them; Task #3049),
 *                    whatever the engine switch; once (requireAuth + ADMIN)
 *   POST /episodes/:episodeId/draft-event  { show_id } drafts the posts of
 *                    an episode's event before it is completed (step 6b);
 *                    they all wait in Review; once (requireAuth + ADMIN)
 *
 * GET's state lists those episodes as episodes_without_posts, and the
 * episodes whose event posts can be drafted early as episodes_with_draft_events.
 */
const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badShow = (res) => res.status(400).json({ success: false, error: 'show_id must be a show id (UUID).' });

/** A QueueError as its response; false for anything else. */
function sendKnown(res, err) {
  if (err instanceof require('../services/pulseQueue').QueueError) {
    res.status(err.status).json({ success: false, error: err.message });
    return true;
  }
  return false;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const showId = String(req.query.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const state = await require('../services/pulseQueue').stateOf(getModels(), showId);
    return res.json({ success: true, ...state });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseEngine] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const showId = String(body.show_id || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    const queue = require('../services/pulseQueue');
    const db = getModels();
    await queue.saveSettings(db, showId, {
      automated_requests: body.automated_requests, manual_requests: body.manual_requests, ambient_enabled: body.ambient_enabled,
    });
    return res.json({ success: true, ...(await queue.stateOf(db, showId)) });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseEngine] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/episodes/:episodeId/queue', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = String(req.body?.show_id || '');
    const episodeId = String(req.params.episodeId || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    if (!UUID_RE.test(episodeId)) return res.status(400).json({ success: false, error: 'The episode id must be a UUID.' });
    const db = getModels();
    const waiting = await require('../services/pulseEventPosting').episodesWithoutPosts(db, showId, { limit: 1000 });
    if (!waiting.some((e) => e.id === episodeId)) {
      return res.status(409).json({ success: false, error: 'That episode is not completed, or its posts were queued already.' });
    }
    const jobs = await require('../services/pulseEventPosting').enqueueForEpisode(db, { showId, episodeId, manual: true });
    const posts = jobs.reduce((n, job) => n + (Array.isArray(job.payload_json?.posters) ? job.payload_json.posters.length : 1), 0);
    return res.status(jobs.length ? 201 : 200).json({
      success: true, queued: jobs.length, posts,
      ...(jobs.length ? {} : { message: 'No one would post about it: no Alive character with an approved voice scored high enough.' }),
      ...(await require('../services/pulseQueue').stateOf(db, showId)),
    });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseEngine] queue episode posts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /episodes/:episodeId/draft-event { show_id } (Character Consistency
// Engine step 6b; Evoni, 2026-10-16: "button per episode"): drafts the posts
// of an episode's event before the episode is completed, so they can feed the
// script. Every draft waits in Review ('event_draft'); completion does not
// queue them again.
router.post('/episodes/:episodeId/draft-event', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const showId = String(req.body?.show_id || '');
    const episodeId = String(req.params.episodeId || '');
    if (!UUID_RE.test(showId)) return badShow(res);
    if (!UUID_RE.test(episodeId)) return res.status(400).json({ success: false, error: 'The episode id must be a UUID.' });
    const db = getModels();
    const posting = require('../services/pulseEventPosting');
    const open = await posting.episodesWithDraftEvents(db, showId, { limit: 1000 });
    if (!open.some((e) => e.id === episodeId)) {
      return res.status(409).json({ success: false, error: 'That episode has no event attached, is completed already, or its posts were queued already.' });
    }
    const jobs = await posting.enqueueForEpisode(db, { showId, episodeId, manual: true, early: true });
    const posts = jobs.reduce((n, job) => n + (Array.isArray(job.payload_json?.posters) ? job.payload_json.posters.length : 1), 0);
    return res.status(jobs.length ? 201 : 200).json({
      success: true, queued: jobs.length, posts,
      ...(jobs.length ? {} : { message: 'No one would post about it: no Alive character Lala has met by then has an approved voice and a high enough score.' }),
      ...(await require('../services/pulseQueue').stateOf(db, showId)),
    });
  } catch (err) {
    if (sendKnown(res, err)) return undefined;
    console.error('[PulseEngine] draft event posts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
