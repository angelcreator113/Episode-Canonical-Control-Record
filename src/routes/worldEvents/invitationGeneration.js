/**
 * World Events routes — generating invitations
 *
 * POST   /api/v1/world/:showId/events/:eventId/generate-invitation
 * POST   /api/v1/world/:showId/events/:eventId/reroll-invitation-text
 * POST   /api/v1/world/:showId/events/:eventId/reroll-invitation-background
 * POST   /api/v1/world/:showId/events/:eventId/invitation-estimate
 * GET    /api/v1/world/:showId/invitation-jobs/:jobId
 * GET    /api/v1/world/:showId/invitation-jobs/:jobId/stream
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { runInvitationWork, invitationService, getModels, invitationError } = require('./helpers');

// ═══════════════════════════════════════════════════════════════════════════════
// INVITATION GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every route is scoped: the event must be live in :showId and a version
// must be one of the event's (invitationGeneratorService). The slow ones
// (generate, re-roll text, re-roll background, batch) answer 202 with a job
// id when the body says { async: true } — the page follows the job on
// GET /world/:showId/invitation-jobs/:jobId/stream — and otherwise answer
// when the work is done.


// POST /world/:showId/events/:eventId/generate-invitation
//   { variants?: 1-3, style?: { theme, mood, color_palette, floral_style, border_style },
//     useBrandStyle?: boolean, async?: boolean }
router.post('/world/:showId/events/:eventId/generate-invitation', requireAuth, aiRateLimiter, (req, res) => {
  const { showId, eventId } = req.params;
  const { variants, style, useBrandStyle } = req.body || {};
  return runInvitationWork(req, res, { kind: 'generate', eventId, where: 'generate' }, (models, onProgress) =>
    invitationService().generateInvitation(models, { showId, eventId, variants, style, useBrandStyle, onProgress }));
});

// POST /world/:showId/events/:eventId/reroll-invitation-text — { assetId, async? }
// New words on that version's background; no image call.
router.post('/world/:showId/events/:eventId/reroll-invitation-text', requireAuth, aiRateLimiter, (req, res) => {
  const { showId, eventId } = req.params;
  const { assetId } = req.body || {};
  return runInvitationWork(req, res, { kind: 'reroll-text', eventId, where: 'reroll text' }, (models, onProgress) =>
    invitationService().rerollText(models, { showId, eventId, assetId, onProgress }));
});

// POST /world/:showId/events/:eventId/reroll-invitation-background
//   { assetId, variants?, style?, useBrandStyle?, async? } — new background(s), same words.
router.post('/world/:showId/events/:eventId/reroll-invitation-background', requireAuth, aiRateLimiter, (req, res) => {
  const { showId, eventId } = req.params;
  const { assetId, variants, style, useBrandStyle } = req.body || {};
  return runInvitationWork(req, res, { kind: 'reroll-background', eventId, where: 'reroll background' }, (models, onProgress) =>
    invitationService().rerollBackground(models, { showId, eventId, assetId, variants, style, useBrandStyle, onProgress }));
});

// POST /world/:showId/events/:eventId/invitation-estimate — { variants?, style?, useBrandStyle? }
// The cost and look of a generate before anything is spent. Writes nothing.
router.post('/world/:showId/events/:eventId/invitation-estimate', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { showId, eventId } = req.params;
    const { variants, style, useBrandStyle } = req.body || {};
    const data = await invitationService().estimateInvitation(models, { showId, eventId, variants, style, useBrandStyle });
    return res.json({ success: true, data });
  } catch (err) {
    return invitationError(res, err, 'estimate');
  }
});

// GET /world/:showId/invitation-jobs/:jobId — a job's state (for polling)
router.get('/world/:showId/invitation-jobs/:jobId', requireAuth, (req, res) => {
  const { getJob, publicJob } = require('../../services/invitationJobs');
  const job = getJob(req.params.showId, req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found (it may have finished long ago, or the server restarted).' });
  return res.json({ success: true, job: publicJob(job) });
});

// GET /world/:showId/invitation-jobs/:jobId/stream — SSE: progress, then done | failed
router.get('/world/:showId/invitation-jobs/:jobId/stream', requireAuth, (req, res) => {
  const { getJob, publicJob, subscribe } = require('../../services/invitationJobs');
  const job = getJob(req.params.showId, req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found (it may have finished long ago, or the server restarted).' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('status', publicJob(job));
  if (job.status !== 'running') {
    send(job.status === 'done' ? 'done' : 'failed', publicJob(job));
    return res.end();
  }

  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 15000);
  const unsubscribe = subscribe(job, (event, data) => {
    send(event, data);
    if (event === 'done' || event === 'failed') {
      clearInterval(keepAlive);
      unsubscribe();
      res.end();
    }
  });
  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

module.exports = router;
