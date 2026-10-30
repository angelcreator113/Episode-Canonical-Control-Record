'use strict';

/**
 * The jobs that prepare a clip's voice for Voice Studio (Voice plan V2;
 * Evoni, 2026-10-30), kept in voice_footage_jobs so they survive restarts.
 *
 * The API only queues jobs (a new Lala upload, or Prepare Voice). The
 * footage-only worker (src/workers/voiceFootageWorker.js) claims and runs
 * them; nothing else does. Rules:
 *
 *   - Claiming is atomic and global: under one transaction-level advisory
 *     lock, a job is claimed only when no other job is running with a
 *     fresh heartbeat, so a second worker never runs one alongside (one
 *     extraction at a time).
 *   - A running job beats every HEARTBEAT_MS. One silent for STALE_MS
 *     (the worker stopped or the server restarted) is failed as
 *     "interrupted" when the next claim looks.
 *   - Transient failures (storage or network trouble, an interruption) are
 *     retried automatically as new attempts, after a wait, up to
 *     MAX_ATTEMPTS. Permanent ones (no sound, the original missing, not
 *     eligible, not enough disk) wait for Prepare Voice.
 *   - Idempotent: one live (queued, running or succeeded) job per key, so
 *     a clip is never prepared twice; Prepare Voice on a prepared clip
 *     returns its job.
 *
 * Nothing is deleted, and nothing here touches the clip, its original or
 * its cut-out.
 */

const os = require('os');

const KIND_EXTRACT = 'extract';
const HEARTBEAT_MS = 20 * 1000;
const STALE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60 * 1000, 5 * 60 * 1000]; // before attempt 2, attempt 3
const LOCK_KEY = 'voice_footage_jobs.claim';

// Lanes whose footage is prepared (Evoni, 2026-10-30: Lala first; others
// switched on one at a time after testing, by S3's character profiles).
// JustAWoman's lane is never prepared for Lala's workflow.
const ELIGIBLE_PERFORMERS = Object.freeze(['lala']);

/** Whether footage on this lane is prepared for Voice Studio (S3 replaces this with per-character settings). */
const footageExtractionEnabledFor = (performer) => ELIGIBLE_PERFORMERS.includes(String(performer || '').toLowerCase());

/** VOICE_FROM_FOOTAGE=on (with Voice Studio on): off by default. */
const enabled = () => String(process.env.VOICE_FROM_FOOTAGE || '').toLowerCase() === 'on'
  && String(process.env.VOICE_STUDIO || '').toLowerCase() === 'on';

const extractKey = (clip) => `extract:${clip.id}:${clip.s3_key_raw}`;

class FootageJobError extends Error {
  /** retryable: a transient failure the worker tries again; otherwise it waits for Prepare Voice. */
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const rows = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0] || [];
const one = async (...args) => (await rows(...args))[0] || null;

const JOB_COLUMNS = `id, episode_id, raw_clip_id, performer, kind, status, attempt, idempotency_key, input_ref, output_source_id,
  retryable, error_code, error_message, requested_by, trigger, run_after, started_at, heartbeat_at, finished_at, worker_id, created_at, updated_at`;

/** The live (queued, running or succeeded) job for a key, or null. */
const liveJob = (sequelize, kind, key, t) => one(sequelize,
  `SELECT ${JOB_COLUMNS} FROM voice_footage_jobs
    WHERE kind = :kind AND idempotency_key = :key AND status IN ('queued', 'running', 'succeeded') AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1`, { kind, key }, t);

/** The most recent job for a key (any status), or null. */
const lastJob = (sequelize, kind, key, t) => one(sequelize,
  `SELECT ${JOB_COLUMNS} FROM voice_footage_jobs
    WHERE kind = :kind AND idempotency_key = :key AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1`, { kind, key }, t);

const isUniqueViolation = (err) => err && (err.original?.code === '23505' || err.parent?.code === '23505' || err.name === 'SequelizeUniqueConstraintError');

/**
 * Queues extraction for a clip. Resolves { job, created }: the live job
 * when there is one (never a second), else a new queued row. attempt: the
 * attempt number (a retry passes the next one). Throws FootageJobError
 * NOT_ELIGIBLE for a lane that isn't prepared.
 */
async function enqueueExtract(sequelize, clip, { trigger = 'upload', requestedBy = null, attempt = 1, runAfter = null, transaction = null } = {}) {
  if (!footageExtractionEnabledFor(clip.performer)) {
    throw new FootageJobError('NOT_ELIGIBLE', "Voice is prepared only for Lala's footage for now.");
  }
  const key = extractKey(clip);
  const live = await liveJob(sequelize, KIND_EXTRACT, key, transaction);
  if (live) return { job: live, created: false };
  try {
    const job = await one(sequelize,
      `INSERT INTO voice_footage_jobs (episode_id, raw_clip_id, performer, kind, status, attempt, idempotency_key, input_ref, requested_by, trigger, run_after)
       VALUES (:episodeId, :clipId, :performer, :kind, 'queued', :attempt, :key, :input, :requestedBy, :trigger, COALESCE(:runAfter, NOW()))
       RETURNING ${JOB_COLUMNS}`,
      {
        episodeId: clip.episode_id, clipId: clip.id, performer: String(clip.performer).toLowerCase(), kind: KIND_EXTRACT,
        attempt, key, input: clip.s3_key_raw, requestedBy, trigger, runAfter,
      }, transaction);
    return { job, created: true };
  } catch (err) {
    // Another request queued it a moment ago: return that one.
    if (isUniqueViolation(err)) {
      const raced = await liveJob(sequelize, KIND_EXTRACT, key, transaction);
      if (raced) return { job: raced, created: false };
    }
    throw err;
  }
}

/**
 * After a new upload (both upload paths): queues extraction when the flag
 * is on and the lane is eligible. Never throws: an upload is never failed
 * by this (logged instead). Resolves the job or null.
 */
async function onClipUploaded(sequelize, clip, { userId = null } = {}) {
  if (!enabled() || !clip || !footageExtractionEnabledFor(clip.performer) || !clip.s3_key_raw) return null;
  try {
    const { job } = await enqueueExtract(sequelize, clip, { trigger: 'upload', requestedBy: userId });
    return job;
  } catch (err) {
    console.error(`[voiceFootage] could not queue voice preparation for clip ${clip.id} (the upload is kept):`, err.message);
    return null;
  }
}

/**
 * Prepare Voice (admin): queues extraction for an existing clip, such as
 * footage uploaded before this existed. A clip already prepared, or with
 * a job queued or running, returns that job. After a failure, a new
 * attempt is queued.
 */
async function prepare(sequelize, clip, { userId = null } = {}) {
  const key = extractKey(clip);
  const last = await lastJob(sequelize, KIND_EXTRACT, key);
  const attempt = last && last.status === 'failed' ? Math.min(last.attempt + 1, 20) : 1;
  return enqueueExtract(sequelize, clip, { trigger: last && last.status === 'failed' ? 'retry' : 'prepare', requestedBy: userId, attempt });
}

/**
 * Marks running jobs whose heartbeat is older than STALE_MS failed as
 * interrupted (transient), and queues their retry. Inside the claim's
 * transaction. Resolves the number recovered.
 */
async function recoverStale(sequelize, transaction, { staleMs = STALE_MS } = {}) {
  const stale = await rows(sequelize,
    `UPDATE voice_footage_jobs
        SET status = 'failed', retryable = TRUE, error_code = 'INTERRUPTED',
            error_message = 'Stopped before it finished (the worker or the server restarted).',
            finished_at = NOW(), updated_at = NOW()
      WHERE status = 'running' AND deleted_at IS NULL
        AND COALESCE(heartbeat_at, started_at, created_at) < NOW() - (:staleMs::text || ' milliseconds')::interval
      RETURNING ${JOB_COLUMNS}`, { staleMs }, transaction);
  for (const job of stale) {
    console.error(`[voiceFootage] job ${job.id} (clip ${job.raw_clip_id}, attempt ${job.attempt}) was interrupted`);
    // eslint-disable-next-line no-await-in-loop
    await queueRetry(sequelize, job, transaction);
  }
  return stale.length;
}

/** Queues the next attempt of a failed transient job, when attempts remain. Resolves the new job or null. */
async function queueRetry(sequelize, failed, transaction) {
  if (failed.attempt >= MAX_ATTEMPTS) {
    console.error(`[voiceFootage] job ${failed.id} failed ${failed.attempt} times; waiting for Prepare Voice`);
    return null;
  }
  const delay = RETRY_DELAYS_MS[Math.min(failed.attempt - 1, RETRY_DELAYS_MS.length - 1)];
  try {
    return await one(sequelize,
      `INSERT INTO voice_footage_jobs (episode_id, raw_clip_id, performer, kind, status, attempt, idempotency_key, input_ref, requested_by, trigger, run_after)
       VALUES (:episodeId, :clipId, :performer, :kind, 'queued', :attempt, :key, :input, :requestedBy, 'retry', NOW() + (:delay::text || ' milliseconds')::interval)
       RETURNING ${JOB_COLUMNS}`,
      {
        episodeId: failed.episode_id, clipId: failed.raw_clip_id, performer: failed.performer, kind: failed.kind,
        attempt: failed.attempt + 1, key: failed.idempotency_key, input: failed.input_ref, requestedBy: failed.requested_by, delay,
      }, transaction);
  } catch (err) {
    if (isUniqueViolation(err)) return null; // a live job for the key already exists
    throw err;
  }
}

/**
 * Claims the next due job, atomically, for workerId. Resolves the job
 * (now running) or null when none is due, or when another job is still
 * running with a fresh heartbeat (one at a time across every worker).
 */
async function claimNext(sequelize, workerId, { staleMs = STALE_MS } = {}) {
  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: LOCK_KEY }, transaction });
    await recoverStale(sequelize, transaction, { staleMs });
    const busy = await one(sequelize,
      `SELECT id FROM voice_footage_jobs WHERE status = 'running' AND deleted_at IS NULL LIMIT 1`, {}, transaction);
    if (busy) return null;
    return one(sequelize,
      `UPDATE voice_footage_jobs
          SET status = 'running', started_at = NOW(), heartbeat_at = NOW(), worker_id = :workerId, updated_at = NOW()
        WHERE id = (
          SELECT id FROM voice_footage_jobs
           WHERE status = 'queued' AND run_after <= NOW() AND deleted_at IS NULL
           ORDER BY run_after, created_at
           LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING ${JOB_COLUMNS}`, { workerId }, transaction);
  });
}

/** Keeps a running job's heartbeat fresh. Resolves false when the job is no longer this worker's. */
async function heartbeat(sequelize, jobId, workerId) {
  const row = await one(sequelize,
    `UPDATE voice_footage_jobs SET heartbeat_at = NOW(), updated_at = NOW()
      WHERE id = :jobId AND status = 'running' AND worker_id = :workerId RETURNING id`, { jobId, workerId });
  return Boolean(row);
}

/** Marks the job succeeded with its source. Only a running job of this worker. */
async function succeed(sequelize, jobId, workerId, sourceId) {
  return one(sequelize,
    `UPDATE voice_footage_jobs
        SET status = 'succeeded', output_source_id = :sourceId, retryable = NULL, error_code = NULL, error_message = NULL,
            finished_at = NOW(), updated_at = NOW()
      WHERE id = :jobId AND status = 'running' AND worker_id = :workerId RETURNING ${JOB_COLUMNS}`, { jobId, workerId, sourceId });
}

/**
 * Marks the job failed with a plain message; a retryable failure queues
 * the next attempt (in the same transaction). Resolves { job, retry }.
 */
async function fail(sequelize, jobId, workerId, err) {
  const retryable = Boolean(err && err.retryable);
  const code = String(err?.code || 'FAILED').slice(0, 60);
  const message = String(err?.message || 'Preparing the voice failed.').slice(0, 1000);
  return sequelize.transaction(async (transaction) => {
    const job = await one(sequelize,
      `UPDATE voice_footage_jobs
          SET status = 'failed', retryable = :retryable, error_code = :code, error_message = :message,
              finished_at = NOW(), updated_at = NOW()
        WHERE id = :jobId AND status = 'running' AND worker_id = :workerId RETURNING ${JOB_COLUMNS}`,
      { jobId, workerId, retryable, code, message }, transaction);
    const retry = job && retryable ? await queueRetry(sequelize, job, transaction) : null;
    return { job, retry };
  });
}

/**
 * The Files page's voice line for each clip of the episode (admin): the
 * latest job per clip as { [clipId]: { status, attempt, error, retrying,
 * finished_at } }.
 */
async function statusForEpisode(sequelize, episodeId) {
  const latest = await rows(sequelize,
    `SELECT DISTINCT ON (raw_clip_id) ${JOB_COLUMNS} FROM voice_footage_jobs
      WHERE episode_id = :episodeId AND kind = :kind AND deleted_at IS NULL
      ORDER BY raw_clip_id, created_at DESC`, { episodeId, kind: KIND_EXTRACT });
  const out = {};
  for (const j of latest) {
    out[j.raw_clip_id] = {
      status: j.status,
      attempt: j.attempt,
      error: j.status === 'failed' ? j.error_message : null,
      waiting_for_retry: j.status === 'queued' && j.trigger === 'retry',
      needs_action: j.status === 'failed',
      updated_at: j.updated_at,
    };
  }
  return out;
}

/** A name for this worker process in job rows (host and pid). */
const workerName = () => `${os.hostname()}:${process.pid}`.slice(0, 120);

module.exports = {
  KIND_EXTRACT, HEARTBEAT_MS, STALE_MS, MAX_ATTEMPTS, RETRY_DELAYS_MS, ELIGIBLE_PERFORMERS,
  FootageJobError, enabled, footageExtractionEnabledFor, extractKey,
  enqueueExtract, onClipUploaded, prepare, claimNext, recoverStale, heartbeat, succeed, fail, statusForEpisode, workerName,
};
