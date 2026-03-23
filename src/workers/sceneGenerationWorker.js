'use strict';

/**
 * Scene Generation Worker
 *
 * Polls the generation_jobs table for queued jobs and processes them
 * using sceneGenerationService. Runs inside the existing worker process.
 *
 * Processing loop:
 *   1. SELECT one queued job (ORDER BY priority DESC, created_at ASC)
 *   2. SET status = 'processing', started_at = NOW()
 *   3. Call the appropriate sceneGenService method
 *   4. SET status = 'completed', result = {...}, completed_at = NOW()
 *   5. On error: SET status = 'failed', error = message (retry if attempts < max)
 *   6. Sleep POLL_INTERVAL_MS, repeat
 */

const { Op } = require('sequelize');
const { GenerationJob, SceneSet, SceneAngle, sequelize } = require('../models');
const sceneGenService = require('../services/sceneGenerationService');

const POLL_INTERVAL_MS = parseInt(process.env.GEN_WORKER_POLL_MS, 10) || 3000;
const CONCURRENCY = parseInt(process.env.GEN_WORKER_CONCURRENCY, 10) || 1;

let running = false;
let activeJobs = 0;

// ─── Claim one job atomically ────────────────────────────────────────────────

async function claimNextJob() {
  // Use a transaction to prevent two workers from grabbing the same job
  const job = await sequelize.transaction(async (t) => {
    const candidate = await GenerationJob.findOne({
      where: {
        status: 'queued',
        [Op.or]: [
          { attempts: { [Op.lt]: sequelize.col('max_attempts') } },
        ],
      },
      order: [
        ['priority', 'DESC'],
        ['created_at', 'ASC'],
      ],
      lock: t.LOCK.UPDATE,
      skipLocked: true,
      transaction: t,
    });

    if (!candidate) return null;

    await candidate.update({
      status: 'processing',
      started_at: new Date(),
      attempts: candidate.attempts + 1,
    }, { transaction: t });

    return candidate;
  });

  return job;
}

// ─── Process a single job ────────────────────────────────────────────────────

async function processJob(job) {
  const models = { SceneSet, SceneAngle };

  try {
    console.log(`🎬 [GenWorker] Processing job ${job.id} — ${job.job_type}`);

    let result;

    switch (job.job_type) {
      case 'generate_base': {
        const set = await SceneSet.findByPk(job.scene_set_id);
        if (!set) throw new Error(`Scene set ${job.scene_set_id} not found`);
        result = await sceneGenService.generateBaseScene(set, models);
        break;
      }

      case 'generate_angle': {
        const set = await SceneSet.findByPk(job.scene_set_id);
        if (!set) throw new Error(`Scene set ${job.scene_set_id} not found`);
        const angle = await SceneAngle.findByPk(job.scene_angle_id);
        if (!angle) throw new Error(`Scene angle ${job.scene_angle_id} not found`);
        result = await sceneGenService.generateAngle(angle, set, models);
        break;
      }

      case 'regenerate_angle': {
        const set = await SceneSet.findByPk(job.scene_set_id);
        if (!set) throw new Error(`Scene set ${job.scene_set_id} not found`);
        const angle = await SceneAngle.findByPk(job.scene_angle_id);
        if (!angle) throw new Error(`Scene angle ${job.scene_angle_id} not found`);
        const categories = job.payload?.categories || [];
        result = await sceneGenService.regenerateAngleRefined(angle, set, categories, models);
        break;
      }

      case 'cascade_regenerate': {
        const set = await SceneSet.findByPk(job.scene_set_id, {
          include: [{ model: SceneAngle, as: 'angles' }],
        });
        if (!set) throw new Error(`Scene set ${job.scene_set_id} not found`);

        // Step 1: Generate base
        const baseResult = await sceneGenService.generateBaseScene(set, models);

        // Step 2: Generate all angles sequentially
        const angleResults = [];
        const freshSet = await SceneSet.findByPk(set.id);
        for (const angle of (set.angles || [])) {
          try {
            const freshAngle = await SceneAngle.findByPk(angle.id);
            await sceneGenService.generateAngle(freshAngle, freshSet, models);
            angleResults.push({ id: angle.id, label: angle.angle_label, success: true });
          } catch (err) {
            angleResults.push({ id: angle.id, label: angle.angle_label, success: false, error: err.message });
          }
        }

        result = {
          base: baseResult,
          angles: angleResults,
          totalAngles: angleResults.length,
          successfulAngles: angleResults.filter(a => a.success).length,
        };
        break;
      }

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark completed
    await job.update({
      status: 'completed',
      result: result || {},
      completed_at: new Date(),
    });

    console.log(`✅ [GenWorker] Job ${job.id} completed`);
  } catch (err) {
    console.error(`❌ [GenWorker] Job ${job.id} failed:`, err.message);

    const canRetry = job.attempts < job.max_attempts;
    await job.update({
      status: canRetry ? 'queued' : 'failed',
      error: err.message,
      completed_at: canRetry ? null : new Date(),
    });

    // If the job was for an angle, reset its status on permanent failure
    if (!canRetry && job.scene_angle_id) {
      try {
        await SceneAngle.update(
          { generation_status: 'failed' },
          { where: { id: job.scene_angle_id } }
        );
      } catch (updateErr) {
        console.error(`[GenWorker] Failed to update angle status:`, updateErr.message);
      }
    }
  }
}

// ─── Polling loop ────────────────────────────────────────────────────────────

async function pollLoop() {
  while (running) {
    try {
      if (activeJobs < CONCURRENCY) {
        const job = await claimNextJob();
        if (job) {
          activeJobs++;
          processJob(job).finally(() => { activeJobs--; });
          continue; // Check for more jobs immediately
        }
      }
    } catch (err) {
      console.error('[GenWorker] Poll error:', err.message);
    }

    // Sleep before next poll
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ─── Start / Stop ────────────────────────────────────────────────────────────

async function recoverStuckJobs() {
  // Any job left in 'processing' means the previous worker died mid-flight.
  // Reset them to 'queued' (if under max_attempts) so they get retried,
  // or mark them 'failed' if they've exhausted retries.
  try {
    const stuck = await GenerationJob.findAll({
      where: { status: 'processing' },
    });
    for (const job of stuck) {
      if (job.attempts < job.max_attempts) {
        await job.update({ status: 'queued', started_at: null });
        console.log(`🔄 [GenWorker] Recovered stuck job ${job.id} (${job.job_type}) → queued`);
      } else {
        await job.update({
          status: 'failed',
          error: 'Worker restarted mid-job (max attempts reached)',
          completed_at: new Date(),
        });
        console.log(`💀 [GenWorker] Abandoned stuck job ${job.id} — max attempts exhausted`);
      }
    }
    if (stuck.length === 0) {
      console.log('🎬 [GenWorker] No stuck jobs found');
    }
  } catch (err) {
    console.error('[GenWorker] Failed to recover stuck jobs:', err.message);
  }
}

function start() {
  if (running) return;
  running = true;
  console.log(`🎬 [GenWorker] Started — polling every ${POLL_INTERVAL_MS}ms, concurrency ${CONCURRENCY}`);
  recoverStuckJobs().then(() => pollLoop());
}

function stop() {
  running = false;
  console.log('🎬 [GenWorker] Stopping...');
}

module.exports = { start, stop };
