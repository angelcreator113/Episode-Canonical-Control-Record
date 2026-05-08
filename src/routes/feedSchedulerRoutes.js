'use strict';

/**
 * feedSchedulerRoutes.js — Feed Automation Scheduler API
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/feed-scheduler', feedSchedulerRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET    /status          — scheduler status + last run summary
 * GET    /history         — past run reports (newest first)
 * GET    /config          — current scheduler configuration
 * PUT    /config          — update scheduler configuration
 * POST   /start           — start the scheduler
 * POST   /stop            — stop the scheduler
 * POST   /run-now         — trigger a single cycle immediately
 * POST   /fill-one        — generate a single profile (for testing)
 * GET    /layer-status    — current cap counts for both layers
 */

const express = require('express');
const router  = express.Router();

const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  getHistory,
  getConfig,
  updateConfig,
  runManualCycle,
  generateCreatorSpark,
  generateSmartSparks,
  generateAndSaveProfile,
  autoGenerateBatch,
  validateClaudeAccess,
  setDb,
  addSSEClient,
} = require('../services/feedScheduler');

// ── GET /status ─────────────────────────────────────────────────────────────
router.get('/status', requireAuth, (req, res) => {
  res.json(getSchedulerStatus());
});

// ── GET /events ─────────────────────────────────────────────────────────────
// SSE stream for real-time scheduler status updates
router.get('/events', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: ${JSON.stringify(getSchedulerStatus())}\n\n`);
  addSSEClient(res);
  req.on('close', () => res.end());
});

// ── GET /history ────────────────────────────────────────────────────────────
router.get('/history', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const history = getHistory();
  res.json({ history: history.slice(0, limit), total: history.length });
});

// ── GET /config ─────────────────────────────────────────────────────────────
router.get('/config', requireAuth, (req, res) => {
  res.json(getConfig());
});

// ── PUT /config ─────────────────────────────────────────────────────────────
router.put('/config', requireAuth, (req, res) => {
  const updated = updateConfig(req.body);
  res.json({ config: updated, message: 'Configuration updated' });
});

// ── POST /start ─────────────────────────────────────────────────────────────
router.post('/start', requireAuth, (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  const intervalHours = req.body.interval_hours || null;
  startScheduler(intervalHours, db);
  res.json({ message: 'Feed scheduler started', status: getSchedulerStatus() });
});

// ── POST /stop ──────────────────────────────────────────────────────────────
router.post('/stop', requireAuth, (req, res) => {
  stopScheduler();
  res.json({ message: 'Feed scheduler stopped', status: getSchedulerStatus() });
});

// ── POST /run-now ───────────────────────────────────────────────────────────
router.post('/run-now', requireAuth, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  setDb(db);

  try {
    const report = await runManualCycle(db);
    res.json({ message: 'Manual cycle complete', report });
  } catch (err) {
    console.error('[FeedScheduler] Manual run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /fill-one ──────────────────────────────────────────────────────────
// Generate a single auto-filled profile (useful for testing)
router.post('/fill-one', requireAuth, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  const layer = req.body.feed_layer || 'real_world';

  try {
    const spark = generateCreatorSpark(layer);
    const profile = await generateAndSaveProfile(db, spark, layer);
    res.json({
      message: `Auto-generated profile for ${layer}`,
      spark,
      profile,
    });
  } catch (err) {
    console.error('[FeedScheduler] Fill-one error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /layer-status ───────────────────────────────────────────────────────
router.get('/layer-status', requireAuth, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');

  try {
    const FEED_CAPS = { real_world: 443, lalaverse: 200 };
    const layers = {};

    for (const [layer, cap] of Object.entries(FEED_CAPS)) {
      const total = await db.SocialProfile.count({ where: { feed_layer: layer, lalaverse_cap_exempt: false } });
      const generated = await db.SocialProfile.count({ where: { feed_layer: layer, status: 'generated' } });
      const finalized = await db.SocialProfile.count({ where: { feed_layer: layer, status: 'finalized' } });
      const crossed = await db.SocialProfile.count({ where: { feed_layer: layer, status: 'crossed' } });

      layers[layer] = {
        total, cap, remaining: cap - total,
        fill_pct: Math.round((total / cap) * 100),
        breakdown: { generated, finalized, crossed },
      };
    }

    res.json({ layers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auto-generate ─────────────────────────────────────────────────────
// Fully automated batch generation — AI creates the sparks AND the profiles.
// No manual input needed. This replaces the manual "New Creator Spark" form.
router.post('/auto-generate', requireAuth, aiRateLimiter, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  const layer = req.body.feed_layer || 'real_world';
  const count = Math.min(parseInt(req.body.count) || 5, 20); // max 20 per request

  // SSE streaming for real-time progress
  if (req.body.stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`data: ${JSON.stringify({ type: 'started', count, layer })}\n\n`);

    try {
      const result = await autoGenerateBatch(db, layer, count, (progress) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
      });

      res.write(`data: ${JSON.stringify({ type: 'done', created: result.created.length, errors: result.errors.length, sparks_generated: result.sparks_generated })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    }
    res.end();
    return;
  }

  // Standard JSON response
  try {
    const result = await autoGenerateBatch(db, layer, count);
    res.json({
      message: `Auto-generated ${result.created.length} profiles for ${layer}`,
      created: result.created.length,
      errors: result.errors,
      sparks_generated: result.sparks_generated,
      profiles: result.created.map(p => ({
        id: p.id,
        handle: p.handle,
        platform: p.platform,
        display_name: p.display_name,
        archetype: p.archetype,
        follower_tier: p.follower_tier,
        lala_relevance_score: p.lala_relevance_score,
      })),
    });
  } catch (err) {
    console.error('[FeedScheduler] Auto-generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auto-generate-job ──────────────────────────────────────────────────
// Background auto-generation — returns immediately with a job ID so the user
// can navigate away and generation continues server-side.
// Progress is tracked via the existing bulk-job SSE infrastructure.
router.post('/auto-generate-job', requireAuth, aiRateLimiter, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  const layer = req.body.feed_layer || 'real_world';
  const count = Math.min(parseInt(req.body.count) || 5, 20);

  if (!db || !db.BulkImportJob) {
    return res.status(500).json({ error: 'BulkImportJob model not available — run migration first' });
  }

  try {
    // Check cap before creating a job — reject early if feed is full
    const FEED_CAPS = { real_world: 443, lalaverse: 200 };
    const cap = FEED_CAPS[layer] || 443;
    const currentCount = await db.SocialProfile.count({
      where: { feed_layer: layer, lalaverse_cap_exempt: false },
    });
    if (currentCount >= cap) {
      return res.status(409).json({
        error: `Feed cap reached (${currentCount}/${cap}). Delete or exempt profiles to generate more.`,
        current: currentCount,
        cap,
      });
    }

    // Pre-flight: validate Claude API access before creating a job
    const apiCheck = await validateClaudeAccess();
    if (!apiCheck.ok) {
      console.error(`[FeedScheduler] Pre-flight API check failed: ${apiCheck.error}`);
      return res.status(503).json({
        error: `AI service unavailable: ${apiCheck.error}`,
        detail: 'The Claude API must be reachable to generate profiles. Check your ANTHROPIC_API_KEY.',
      });
    }

    // Create a job record so progress is persisted in the DB
    const job = await db.BulkImportJob.create({
      status: 'pending',
      total: count,
      completed: 0,
      failed: 0,
      candidates: [], // will be populated with generated sparks
      results: [],
      character_context: { auto_generate: true, feed_layer: layer },
      character_key: `auto-gen-${layer}`,
    });

    // Process in background — completely decoupled from this HTTP response
    processAutoGenInBackground(job.id, db, layer, count);

    return res.json({
      job_id: job.id,
      status: 'pending',
      total: count,
      message: `Auto-generate job #${job.id} queued. ${count} profiles will be generated in the background.`,
    });
  } catch (err) {
    console.error('[FeedScheduler] Auto-generate-job error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Background auto-generation processor ────────────────────────────────────
// Runs autoGenerateBatch server-side, updating the BulkImportJob record and
// pushing SSE events so the frontend can track progress (even after reconnect).
function processAutoGenInBackground(jobId, db, layer, count) {
  // Import the SSE notifier from bulk routes
  let notifyJobSSE;
  try {
    const bulkRoutes = require('./socialProfileBulkRoutes');
    notifyJobSSE = bulkRoutes.notifyJobSSE;
    if (!notifyJobSSE) {
      console.warn(`[FeedScheduler] notifyJobSSE not exported from socialProfileBulkRoutes — SSE events will be lost`);
      notifyJobSSE = () => {};
    }
  } catch (err) {
    console.error(`[FeedScheduler] Failed to import socialProfileBulkRoutes:`, err.message);
    notifyJobSSE = () => {};
  }

  setImmediate(async () => {
    let job;
    try {
      job = await db.BulkImportJob.findByPk(jobId);
      if (!job || job.status !== 'pending') return;

      await job.update({ status: 'processing', started_at: new Date() });
      notifyJobSSE(jobId, 'started', { job_id: jobId, total: count });
      console.log(`[FeedScheduler] Auto-gen job #${jobId} started: layer=${layer}, count=${count}`);

      const created = [];
      const errors = [];

      const result = await autoGenerateBatch(db, layer, count, async (progress) => {
        console.log(`[FeedScheduler] Job #${jobId} progress: status=${progress.status}, current=${progress.current}/${progress.total}${progress.error ? ', error=' + progress.error : ''}`);
        // Update DB on each profile so progress survives page navigation
        if (progress.status === 'created' && progress.profile) {
          created.push({
            handle: progress.profile.handle,
            platform: progress.profile.platform,
            status: 'success',
            profile_id: progress.profile.id,
          });
        } else if (progress.status === 'error') {
          errors.push({ error: progress.error });
        }

        const completedCount = created.length;
        const failedCount = errors.length;

        // Wrap DB update in try/catch so a transient DB error doesn't crash the whole job
        try {
          await job.update({
            completed: completedCount,
            failed: failedCount,
            total: progress.total || count,
          });
        } catch (dbErr) {
          console.warn(`[FeedScheduler] Job #${jobId} progress DB update failed (non-fatal): ${dbErr.message}`);
        }

        // Push SSE event (same format as bulk import)
        if (progress.status === 'created') {
          notifyJobSSE(jobId, 'profile_complete', {
            completed: completedCount,
            failed: failedCount,
            total: progress.total || count,
            spark: progress.spark,
          });
        } else if (progress.status === 'error') {
          notifyJobSSE(jobId, 'profile_failed', {
            completed: completedCount,
            failed: failedCount,
            total: progress.total || count,
            error: progress.error,
          });
        } else if (progress.status === 'generating') {
          notifyJobSSE(jobId, 'profile_generating', {
            current: progress.current,
            total: progress.total || count,
            spark: progress.spark,
          });
        }
      });

      await job.update({
        status: 'completed',
        completed: result.created.length,
        failed: result.errors.length,
        results: created,
        completed_at: new Date(),
      });

      notifyJobSSE(jobId, 'done', {
        job_id: jobId,
        status: 'completed',
        completed: result.created.length,
        failed: result.errors.length,
        total: count,
      });

      console.log(`✅ Auto-generate job #${jobId} completed: ${result.created.length} created, ${result.errors.length} errors`);
    } catch (err) {
      console.error(`❌ Auto-generate job #${jobId} fatal error:`, err.message);
      if (job) {
        await job.update({
          status: 'failed',
          error_message: err.message,
          completed_at: new Date(),
        }).catch(e => console.warn('[feed-scheduler] job status update error:', e?.message));
      }
      // Use 'job_error' instead of 'error' — SSE event named 'error' conflicts
      // with EventSource's built-in error event, causing the browser to treat
      // it as a connection failure instead of delivering the error data.
      notifyJobSSE(jobId, 'job_error', { job_id: jobId, error: err.message });
    }
  });
}

// ── POST /preview-sparks ────────────────────────────────────────────────────
// Preview what the AI would generate without actually creating profiles.
router.post('/preview-sparks', requireAuth, aiRateLimiter, async (req, res) => {
  const db = req.app.locals.db || req.app.get('models') || require('../models');
  const layer = req.body.feed_layer || 'real_world';
  const count = Math.min(parseInt(req.body.count) || 5, 20);

  try {
    const apiCheck = await validateClaudeAccess();
    if (!apiCheck.ok) {
      return res.status(503).json({ error: `AI service unavailable: ${apiCheck.error}` });
    }
    const sparks = await generateSmartSparks(db, layer, count);
    res.json({ sparks, layer, count: sparks.length });
  } catch (err) {
    console.error('[FeedScheduler] Preview sparks error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
