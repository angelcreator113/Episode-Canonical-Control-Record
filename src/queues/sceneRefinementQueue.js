'use strict';

/**
 * Scene Refinement Queue — v1.0
 *
 * Multi-pass auto-refinement pipeline using Bull queue.
 * When a generated angle scores below threshold, it is automatically
 * queued for regeneration with refined prompts (up to MAX_PASSES).
 *
 * Flow:
 *   1. After angle generation, if quality_score < threshold → add to queue
 *   2. Worker picks up job → calls regenerateAngleRefined with artifact flags
 *   3. Re-analyzes quality → if still below threshold and passes < max, re-queues
 *   4. After final pass (or quality met), runs post-processing pipeline
 */

const Bull = require('bull');
const { redisConfig } = require('../config/redis');

const MAX_REFINEMENT_PASSES = 3;
const QUALITY_THRESHOLD = 70;

let queueErrorLogged = false;

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
        console.warn('[RefinementQueue] Redis unavailable — stopping reconnection');
        queueErrorLogged = true;
      }
      return null;
    }
    return Math.min(times * 500, 3000);
  },
};

const refinementQueue = new Bull('scene-refinement', {
  createClient(type) {
    const IORedis = require('ioredis');
    const client = new IORedis(sharedRedisOpts);
    client.on('error', (err) => {
      if (!err.message.includes('ECONNREFUSED') || !queueErrorLogged) {
        console.error('[RefinementQueue] Error:', err.message);
        if (err.message.includes('ECONNREFUSED')) queueErrorLogged = true;
      }
    });
    return client;
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 50 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
  settings: {
    stalledInterval: 60000,
    maxStalledCount: 1,
    lockDuration: 600000,
    lockRenewTime: 300000,
  },
});

// ─── QUEUE EVENTS ────────────────────────────────────────────────────────────

refinementQueue.on('active', (job) => {
  console.log(`[RefinementQueue] Job ${job.id} started — pass ${job.data.pass}/${MAX_REFINEMENT_PASSES}`);
});

refinementQueue.on('completed', (job, result) => {
  console.log(`[RefinementQueue] Job ${job.id} completed — score: ${result?.qualityScore || 'N/A'}`);
});

refinementQueue.on('failed', (job, err) => {
  console.error(`[RefinementQueue] Job ${job.id} failed: ${err.message}`);
});

refinementQueue.on('error', (error) => {
  if (!error.message.includes('ECONNREFUSED') || !queueErrorLogged) {
    console.error('[RefinementQueue] Queue error:', error.message);
  }
});

// ─── WORKER PROCESSOR ────────────────────────────────────────────────────────

/**
 * Register the refinement worker processor.
 * Must be called once at app startup.
 */
function registerWorker() {
  const sceneGenService = require('../services/sceneGenerationService');
  const postProcessService = require('../services/postProcessingService');

  refinementQueue.process('refine-angle', 2, async (job) => {
    const {
      angleId,
      sceneSetId,
      artifactCategories,
      pass,
      qualityThreshold = QUALITY_THRESHOLD,
      runPostProcessing = true,
    } = job.data;

    // Load models lazily to avoid circular deps
    const { SceneAngle, SceneSet } = require('../models');

    const angle = await SceneAngle.findByPk(angleId);
    const set = await SceneSet.findByPk(sceneSetId);

    if (!angle || !set) {
      throw new Error(`Angle ${angleId} or Set ${sceneSetId} not found`);
    }

    console.log(`[RefinementQueue] Pass ${pass}: regenerating ${angle.angle_name}`);
    job.progress(10);

    // Run regeneration with refined prompt
    const result = await sceneGenService.regenerateAngleRefined(
      angle,
      set,
      artifactCategories,
      { SceneAngle, SceneSet }
    );

    job.progress(60);

    // Check if quality meets threshold
    if (result.qualityScore != null && result.qualityScore >= qualityThreshold) {
      console.log(`[RefinementQueue] Quality met (${result.qualityScore} >= ${qualityThreshold})`);

      // Run post-processing on the final result
      if (runPostProcessing) {
        try {
          const refreshedAngle = await SceneAngle.findByPk(angleId);
          await postProcessService.processAngleAssets(refreshedAngle, set, { SceneAngle });
        } catch (ppErr) {
          console.warn(`[RefinementQueue] Post-processing failed (non-blocking): ${ppErr.message}`);
        }
      }

      job.progress(100);
      return { qualityScore: result.qualityScore, pass, status: 'quality_met' };
    }

    // If below threshold and more passes available, re-queue
    if (pass < MAX_REFINEMENT_PASSES) {
      console.log(`[RefinementQueue] Quality low (${result.qualityScore}), queuing pass ${pass + 1}`);
      await addRefinementJob({
        angleId,
        sceneSetId,
        artifactCategories: (result.artifactFlags || []).map(f => f.category).filter(Boolean),
        pass: pass + 1,
        qualityThreshold,
        runPostProcessing,
      });

      job.progress(100);
      return { qualityScore: result.qualityScore, pass, status: 'requeued' };
    }

    // Max passes reached — run post-processing anyway on best result
    console.log(`[RefinementQueue] Max passes reached. Final score: ${result.qualityScore}`);

    if (runPostProcessing) {
      try {
        const refreshedAngle = await SceneAngle.findByPk(angleId);
        await postProcessService.processAngleAssets(refreshedAngle, set, { SceneAngle });
      } catch (ppErr) {
        console.warn(`[RefinementQueue] Post-processing failed (non-blocking): ${ppErr.message}`);
      }
    }

    job.progress(100);
    return { qualityScore: result.qualityScore, pass, status: 'max_passes_reached' };
  });

  console.log('[RefinementQueue] Worker registered');
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Add a refinement job to the queue.
 */
async function addRefinementJob(data) {
  const job = await refinementQueue.add('refine-angle', {
    ...data,
    pass: data.pass || 1,
    qualityThreshold: data.qualityThreshold || QUALITY_THRESHOLD,
    createdAt: new Date().toISOString(),
  }, {
    priority: data.priority || 0,
  });

  console.log(`[RefinementQueue] Job ${job.id} added (angle: ${data.angleId}, pass: ${data.pass || 1})`);
  return job;
}

/**
 * Auto-refine an angle if quality is below threshold.
 * Called automatically after generation completes.
 */
async function autoRefineIfNeeded(sceneAngle, sceneSet) {
  const score = sceneAngle.quality_score;
  if (score == null || score >= QUALITY_THRESHOLD) {
    return null;
  }

  const categories = (sceneAngle.artifact_flags || [])
    .map(f => f.category)
    .filter(Boolean);

  if (categories.length === 0) {
    return null;
  }

  console.log(`[RefinementQueue] Auto-refine triggered for ${sceneAngle.angle_name} (score: ${score})`);

  return addRefinementJob({
    angleId: sceneAngle.id,
    sceneSetId: sceneSet.id,
    artifactCategories: categories,
    pass: 1,
  });
}

/**
 * Get refinement queue stats.
 */
async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    refinementQueue.getWaitingCount(),
    refinementQueue.getActiveCount(),
    refinementQueue.getCompletedCount(),
    refinementQueue.getFailedCount(),
    refinementQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

async function getRefinementJob(jobId) {
  return refinementQueue.getJob(jobId);
}

async function closeQueue() {
  try {
    await refinementQueue.close();
    console.log('[RefinementQueue] Queue closed');
  } catch (err) {
    console.error('[RefinementQueue] Close error:', err.message);
  }
}

module.exports = {
  refinementQueue,
  registerWorker,
  addRefinementJob,
  autoRefineIfNeeded,
  getQueueStats,
  getRefinementJob,
  closeQueue,
  MAX_REFINEMENT_PASSES,
  QUALITY_THRESHOLD,
};
