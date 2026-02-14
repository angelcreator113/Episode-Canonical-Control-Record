/**
 * Queue Monitor Route
 * Bull Board dashboard for monitoring export job queues
 * Available at /admin/queues in development
 */

const express = require('express');
const router = express.Router();
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { videoQueue } = require('../queues/videoQueue');

// ============================================================================
// Bull Board Dashboard
// ============================================================================

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(videoQueue)],
  serverAdapter,
});

// Mount Bull Board UI
router.use('/', serverAdapter.getRouter());

// ============================================================================
// Queue Stats API (JSON endpoint)
// ============================================================================

router.get('/stats', async (req, res) => {
  try {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      videoQueue.getWaitingCount(),
      videoQueue.getActiveCount(),
      videoQueue.getCompletedCount(),
      videoQueue.getFailedCount(),
      videoQueue.getDelayedCount(),
      videoQueue.getPausedCount(),
    ]);

    res.json({
      queue: 'video-export',
      counts: { waiting, active, completed, failed, delayed, paused },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error fetching queue stats:', error);
    res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
});

// ============================================================================
// Recent Jobs API
// ============================================================================

router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;

    const [active, completed, failed, waiting] = await Promise.all([
      videoQueue.getActive(0, limit),
      videoQueue.getCompleted(0, limit),
      videoQueue.getFailed(0, limit),
      videoQueue.getWaiting(0, limit),
    ]);

    const formatJob = (job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    });

    res.json({
      active: active.map(formatJob),
      completed: completed.map(formatJob),
      failed: failed.map(formatJob),
      waiting: waiting.map(formatJob),
    });
  } catch (error) {
    console.error('❌ Error fetching recent jobs:', error);
    res.status(500).json({ error: 'Failed to fetch recent jobs' });
  }
});

module.exports = router;
