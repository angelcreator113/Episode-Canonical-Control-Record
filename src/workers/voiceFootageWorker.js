'use strict';

/**
 * The footage-only worker (Voice plan V2; Evoni, 2026-10-30): prepares the
 * voice of Lala's footage for Voice Studio, one clip at a time, from the
 * jobs in voice_footage_jobs.
 *
 * Its own process, separate from episode-worker (src/workers/start.js),
 * and it loads none of that worker's pieces: no scene generation, no video
 * export, no Bull/Redis queues, no AI calls (checked by
 * tests/unit/workers/voiceFootageWorker.isolation.test.js). Starting it
 * starts nothing else.
 *
 * It does nothing unless VOICE_FROM_FOOTAGE=on and VOICE_STUDIO=on: with
 * either off it says so once and idles (so PM2 does not restart it in a
 * loop). It is not in ecosystem.config.js, so `pm2 start ecosystem.config.js`
 * never starts it; it is started only by name. How to start, stop, watch
 * and switch it off: docs/runbooks/voice-footage-worker.md.
 *
 * Each claimed job beats every HEARTBEAT_MS; on SIGINT/SIGTERM the worker
 * stops claiming and records the running job as interrupted (it is retried
 * as a new attempt). A job whose worker vanished is recovered by the next
 * claim (voiceFootageJobs.recoverStale).
 */

require('dotenv').config();

const jobs = require('../services/voiceFootageJobs');

const POLL_MS = Number(process.env.VOICE_FOOTAGE_POLL_MS) || 5000;

let stopping = false;
let current = null; // { job, workerId }

const sleep = (ms) => new Promise((resolve) => { const t = setTimeout(resolve, ms); if (typeof t.unref === 'function' && stopping) t.unref(); });

/**
 * Claims and runs at most one job. Resolves the finished job, or null when
 * none was due. deps (for tests): sequelize, run (job → source).
 */
async function runOnce({ sequelize, workerId, run }) {
  const job = await jobs.claimNext(sequelize, workerId);
  if (!job) return null;
  current = { job, workerId };
  console.log(`[voiceFootage] preparing the voice of clip ${job.raw_clip_id} (job ${job.id}, attempt ${job.attempt})`);
  const beat = setInterval(() => {
    jobs.heartbeat(sequelize, job.id, workerId)
      .then((mine) => { if (!mine) console.error(`[voiceFootage] job ${job.id} is no longer this worker's; its result will not be recorded`); })
      .catch((err) => console.error('[voiceFootage] heartbeat failed:', err.message));
  }, jobs.HEARTBEAT_MS);
  if (typeof beat.unref === 'function') beat.unref();
  try {
    const { source, existed } = await run(job);
    const done = await jobs.succeed(sequelize, job.id, workerId, source.id);
    console.log(`[voiceFootage] clip ${job.raw_clip_id}: voice ready (source ${source.id}${existed ? ', already there' : ''})`);
    return done;
  } catch (raw) {
    const err = require('../services/voiceFootageExtract').classify(raw);
    console.error(`[voiceFootage] clip ${job.raw_clip_id} failed (${err.code}${err.retryable ? ', will retry' : ', needs Prepare Voice'}):`, raw?.code || raw?.name || '', raw?.message);
    const { job: failed } = await jobs.fail(sequelize, job.id, workerId, err);
    return failed;
  } finally {
    clearInterval(beat);
    current = null;
  }
}

/** Stops claiming; a running job is recorded as interrupted so it is retried as a new attempt. */
async function stop(sequelize, signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[voiceFootage] ${signal}: stopping after this moment; no new jobs are claimed`);
  if (current) {
    const { FootageJobError } = jobs;
    try {
      await jobs.fail(sequelize, current.job.id, current.workerId,
        new FootageJobError('INTERRUPTED', 'Stopped before it finished (the worker was stopped).', { retryable: true }));
    } catch (err) {
      console.error('[voiceFootage] could not record the interrupted job (it will be recovered on the next claim):', err.message);
    }
  }
}

async function main() {
  if (!jobs.enabled()) {
    console.log('[voiceFootage] VOICE_FROM_FOOTAGE (or VOICE_STUDIO) is not on: nothing to do. Idle; stop this process or switch the flag on and restart it.');
    // Idle, so PM2 does not restart it in a loop.
    setInterval(() => {}, 60 * 60 * 1000);
    return;
  }
  const { sequelize } = require('../models');
  const { runExtract } = require('../services/voiceFootageExtract');
  const workerId = jobs.workerName();
  const run = (job) => runExtract(job, { sequelize });
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, () => { stop(sequelize, sig).finally(() => process.exit(0)); });
  }
  console.log(`[voiceFootage] started as ${workerId}: one clip at a time, polling every ${POLL_MS} ms`);
  while (!stopping) {
    let did = null;
    try {
      did = await runOnce({ sequelize, workerId, run });
    } catch (err) {
      console.error('[voiceFootage] poll failed:', err.message);
    }
    if (!did) await sleep(POLL_MS);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[voiceFootage] the worker stopped:', err);
    process.exit(1);
  });
}

module.exports = { runOnce, stop, main };
