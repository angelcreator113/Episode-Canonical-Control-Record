/**
 * Video Export Queue
 * Bull queue for managing video export/render jobs
 * Supports progress tracking via Socket.io
 */

const Bull = require('bull');
const { redisConfig } = require('../config/redis');

let queueErrorLogged = false;
let queueConnErrorLogged = false;

// Shared Redis options for Bull's internal connections (client, subscriber, bclient)
const sharedRedisOpts = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      if (!queueErrorLogged) {
        console.warn('⚠️  Bull queue: Redis unavailable — stopping reconnection attempts');
        queueErrorLogged = true;
      }
      return null; // Stop retrying
    }
    return Math.min(times * 500, 3000);
  },
};

// Bull uses ioredis-style config (host/port), not the redis URL format
const videoQueue = new Bull('video-export', {
  createClient(_type) {
    const IORedis = require('ioredis');
    const client = new IORedis(sharedRedisOpts);
    // Attach error handler immediately to prevent unhandled rejections
    client.on('error', (err) => {
      if (err.message.includes('ECONNREFUSED')) {
        if (!queueConnErrorLogged) {
          console.error('\u274c Queue error:', err.message);
          queueConnErrorLogged = true;
        }
      } else {
        console.error('❌ Queue error:', err.message);
      }
    });
    return client;
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,  // Keep completed jobs for 24 hours
      count: 100,       // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
  settings: {
    stalledInterval: 30000,    // Check for stalled jobs every 30s
    maxStalledCount: 2,        // Mark as failed after 2 stalls
    lockDuration: 300000,      // 5 min lock (video exports can be long)
    lockRenewTime: 150000,     // Renew lock halfway through
  },
});

// ============================================================================
// Queue Event Handlers
// ============================================================================

videoQueue.on('waiting', (jobId) => {
  console.log(`📋 Export job ${jobId} waiting in queue`);
});

videoQueue.on('active', (job) => {
  console.log(`🎬 Export job ${job.id} started processing`);
});

videoQueue.on('completed', (job, result) => {
  console.log(`✅ Export job ${job.id} completed`);
  console.log(`   Output: ${result?.outputPath || 'N/A'}`);
});

videoQueue.on('failed', (job, err) => {
  console.error(`❌ Export job ${job.id} failed: ${err.message}`);
  if (job.attemptsMade < job.opts.attempts) {
    console.log(`   Retry ${job.attemptsMade}/${job.opts.attempts} scheduled`);
  }
});

videoQueue.on('stalled', (jobId) => {
  console.warn(`⚠️  Export job ${jobId} stalled`);
});

videoQueue.on('progress', (job, progress) => {
  console.log(`📊 Export job ${job.id} progress: ${progress}%`);
});

videoQueue.on('error', (error) => {
  // Only log non-connection errors once (connection errors handled by createClient error handler)
  if (error.message.includes('ECONNREFUSED')) {
    if (!queueConnErrorLogged) {
      console.error('❌ Queue error:', error.message);
      queueConnErrorLogged = true;
    }
  } else {
    console.error('❌ Queue error:', error.message);
  }
});

// ============================================================================
// Queue Helper Functions
// ============================================================================

/**
 * Add an export job to the queue
 * @param {Object} jobData - Export configuration
 * @param {string} jobData.episodeId - Episode ID
 * @param {string} jobData.compositionId - Composition ID
 * @param {string} jobData.format - Output format (mp4, mov, webm)
 * @param {string} jobData.resolution - Output resolution (1920x1080, etc.)
 * @param {string} jobData.quality - Quality preset (low, medium, high, ultra)
 * @param {string} jobData.userId - User who requested the export
 * @param {Object} [options] - Bull job options override
 * @returns {Promise<Bull.Job>}
 */
async function addExportJob(jobData, options = {}) {
  const job = await videoQueue.add('export-video', {
    ...jobData,
    createdAt: new Date().toISOString(),
  }, {
    priority: jobData.priority || 0,
    ...options,
  });

  console.log(`📋 Export job ${job.id} added to queue`);
  return job;
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue counts by status
 */
async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    videoQueue.getWaitingCount(),
    videoQueue.getActiveCount(),
    videoQueue.getCompletedCount(),
    videoQueue.getFailedCount(),
    videoQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get a specific job by ID
 * @param {string} jobId
 * @returns {Promise<Bull.Job|null>}
 */
async function getExportJob(jobId) {
  return videoQueue.getJob(jobId);
}

/**
 * Cancel a pending export job
 * @param {string} jobId
 * @returns {Promise<void>}
 */
async function cancelExportJob(jobId) {
  const job = await videoQueue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      console.log(`🗑️  Export job ${jobId} cancelled`);
    } else if (state === 'active') {
      // For active jobs, we'll need the worker to check for cancellation
      await job.update({ ...job.data, cancelled: true });
      console.log(`🛑 Export job ${jobId} marked for cancellation`);
    }
  }
}

/**
 * Clean up old jobs
 * @param {number} [gracePeriod=86400000] - Grace period in ms (default 24h)
 */
async function cleanOldJobs(gracePeriod = 86400000) {
  await videoQueue.clean(gracePeriod, 'completed');
  await videoQueue.clean(gracePeriod * 7, 'failed');
  console.log('🧹 Old export jobs cleaned');
}

/**
 * Close the queue gracefully
 */
async function closeQueue() {
  try {
    await videoQueue.close();
    console.log('✅ Video export queue closed');
  } catch (err) {
    console.error('❌ Error closing video queue:', err.message);
  }
}

module.exports = {
  videoQueue,
  addExportJob,
  getQueueStats,
  getExportJob,
  cancelExportJob,
  cleanOldJobs,
  closeQueue,
};
