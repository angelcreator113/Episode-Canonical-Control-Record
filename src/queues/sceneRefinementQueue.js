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
const { claimRow } = require('../services/generationClaimService');
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
  createClient(_type) {
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
    // One attempt: a retried pass pays for its image again (audit, 2026-10-15).
    attempts: 1,
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
  const { refineFixes } = require('../services/artifactDetectionService');

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

    // A pass refines the picture it was queued for: one regenerated since
    // (its Generate) is not overwritten (audit, 2026-10-15).
    if (job.data.attempt != null && (angle.generation_attempt || 0) !== job.data.attempt) {
      console.log(`[RefinementQueue] Pass ${pass} for ${angle.angle_name} dropped: the picture changed since it was queued`);
      return { pass, status: 'skipped', reason: 'picture changed' };
    }
    // One generation of an angle at a time, as the routes claim it: a Generate
    // clicked while this pass waited is not raced and paid for twice.
    if (!(await claimRow(SceneAngle.sequelize, 'angle', angle.id))) {
      console.log(`[RefinementQueue] Pass ${pass} for ${angle.angle_name} dropped: already being generated`);
      return { pass, status: 'skipped', reason: 'already generating' };
    }

    console.log(`[RefinementQueue] Pass ${pass}: regenerating ${angle.angle_name}`);
    job.progress(10);

    // Run regeneration with refined prompt
    let result;
    try {
      result = await sceneGenService.regenerateAngleRefined(
        angle,
        set,
        artifactCategories,
        { SceneAngle, SceneSet }
      );
    } catch (err) {
      // Refused before its generation began: the claim is released.
      await SceneAngle.update({ generation_status: 'failed' }, { where: { id: angle.id, generation_status: 'generating' } })
        .catch((updateErr) => console.error(`[RefinementQueue] Could not release angle ${angle.id}:`, updateErr.message));
      throw err;
    }

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

    // Another pass only with a score to compare and problems it can fix:
    // with no score (the check could not run) or nothing fixable, a pass
    // regenerated the same prompt and paid again (audit, 2026-10-15).
    const nextCategories = (result.artifactFlags || []).map(f => f.category).filter(Boolean);
    const canImprove = result.qualityScore != null && refineFixes(nextCategories).length > 0;
    if (pass < MAX_REFINEMENT_PASSES && canImprove) {
      console.log(`[RefinementQueue] Quality low (${result.qualityScore}), queuing pass ${pass + 1}`);
      const refined = await SceneAngle.findByPk(angleId, { attributes: ['generation_attempt'] });
      await addRefinementJob({
        angleId,
        sceneSetId,
        artifactCategories: nextCategories,
        pass: pass + 1,
        attempt: refined?.generation_attempt || 0,
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
  const pass = data.pass || 1;
  // One chain per picture: the job id names the angle, the pass and the
  // picture (generation_attempt), so a second click while a pass waits gets
  // that job back instead of a second paid chain (audit, 2026-10-15). A
  // finished job with the id (kept for the queue's history) is replaced.
  const jobId = data.attempt != null ? `refine-${data.angleId}-p${pass}-a${data.attempt}` : undefined;
  if (jobId) {
    const existing = await refinementQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (['waiting', 'active', 'delayed', 'paused'].includes(state)) {
        console.log(`[RefinementQueue] Job ${jobId} already ${state}; not added again`);
        existing.duplicate = true;
        return existing;
      }
      await existing.remove();
    }
  }
  const job = await refinementQueue.add('refine-angle', {
    ...data,
    pass,
    qualityThreshold: data.qualityThreshold || QUALITY_THRESHOLD,
    createdAt: new Date().toISOString(),
  }, {
    priority: data.priority || 0,
    ...(jobId ? { jobId } : {}),
  });

  console.log(`[RefinementQueue] Job ${job.id} added (angle: ${data.angleId}, pass: ${pass})`);
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
    attempt: sceneAngle.generation_attempt || 0,
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
