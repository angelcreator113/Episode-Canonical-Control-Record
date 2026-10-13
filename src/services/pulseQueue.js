'use strict';

/**
 * The Pulse's posting queue and engine settings (Task #2968; The Pulse spec
 * §7 "Cost control: a daily generation cap; jobs run through a queue, never
 * in a live request"; docs/reads/2026-10-12-pulse-posting-read.md §4-5).
 * Evoni, 2026-10-12: the ambient worker ships off; the daily cap counts
 * requests, 5 automated and 15 manual per show (Task #3031,
 * services/pulseRequests.js).
 *
 *   settingsOf(db, showId)        { automated_requests, manual_requests,
 *                                 ambient_enabled } from the show's
 *                                 metadata.pulse_engine, defaults filled in
 *   saveSettings(db, showId, …)   writes only metadata.pulse_engine
 *   enqueue(db, { showId, kind, payload, runAfter })
 *   draftsToday(db, showId)       drafts the queue made today (UTC)
 *   runOne(db, { now })           claims the next due job (skipLocked, as
 *                                 workers/sceneGenerationWorker.js), runs its
 *                                 handler, retries with a backoff; a job
 *                                 whose lane's requests are used waits for
 *                                 the reset (event, comment; Task #3049) or
 *                                 is skipped with the reason; null when idle
 *   register(kind, handler)       handler(db, job) → { draftIds, failed? }; the
 *                                 drafting handlers come with #2969-#2971
 *   start() / stop()              the worker loop; app.js starts it only
 *                                 when PULSE_ENGINE_ENABLED === 'true'
 *
 * Each drafting call a handler makes takes one request first
 * (pulseRequests.take); every AI call still passes aiCostTracker's global
 * budget.
 */

const KINDS = ['event', 'ambient', 'comment', 'dm', 'storyline'];   // dm: Task #2984; storyline: Task #2989
const DEFAULTS = { automated_requests: 5, manual_requests: 15, ambient_enabled: false };
const MAX_CAP = 100;   // requests a day, per lane
const BACKOFF_MS = 60 * 1000;            // 1, 4, 9 minutes …
const STALE_MS = 15 * 60 * 1000;         // a job running this long was lost
const POLL_MS = parseInt(process.env.PULSE_ENGINE_POLL_MS, 10) || 15000;
// Kinds that wait for the lane's reset when its requests are used, not skipped (Task #3049).
const WAIT_ON_CAP = ['event', 'comment'];
const CAP_WAIT_MS = 60 * 1000;           // a minute past midnight UTC

const handlers = new Map();

class QueueError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Registers the handler for a kind: handler(db, job) resolves to { draftIds: [] }. */
function register(kind, handler) {
  if (!KINDS.includes(kind)) throw new Error(`Unknown Pulse job kind: ${kind}`);
  handlers.set(kind, handler);
}
const unregister = (kind) => handlers.delete(kind);

/** The show's engine settings, defaults filled in. */
async function settingsOf(db, showId) {
  const [[row]] = await db.sequelize.query(
    `SELECT metadata->'pulse_engine' AS engine FROM shows WHERE id = :showId`, { replacements: { showId } });
  if (!row) throw new QueueError(404, 'Show not found');
  const saved = row.engine && typeof row.engine === 'object' ? row.engine : {};
  const limit = (key) => (Number.isInteger(saved[key]) && saved[key] >= 0 && saved[key] <= MAX_CAP ? saved[key] : DEFAULTS[key]);
  return {
    automated_requests: limit('automated_requests'),
    manual_requests: limit('manual_requests'),
    ambient_enabled: typeof saved.ambient_enabled === 'boolean' ? saved.ambient_enabled : DEFAULTS.ambient_enabled,
  };
}

/** Saves the settings given (others kept), only under metadata.pulse_engine. */
async function saveSettings(db, showId, { automated_requests: automated, manual_requests: manual, ambient_enabled: ambient } = {}) {
  const current = await settingsOf(db, showId);
  for (const [lane, value] of [['automated', automated], ['manual', manual]]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > MAX_CAP)) {
      throw new QueueError(400, `The ${lane} requests a day must be a whole number from 0 to ${MAX_CAP}.`);
    }
  }
  if (ambient !== undefined && typeof ambient !== 'boolean') throw new QueueError(400, 'ambient_enabled must be true or false.');
  const next = {
    ...current,
    ...(automated !== undefined ? { automated_requests: automated } : {}),
    ...(manual !== undefined ? { manual_requests: manual } : {}),
    ...(ambient !== undefined ? { ambient_enabled: ambient } : {}),
  };
  // One statement on the one key: other metadata (pulse_cover, …) is never rewritten.
  await db.sequelize.query(
    `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{pulse_engine}', CAST(:engine AS jsonb))::json,
            updated_at = NOW()
      WHERE id = :showId`, { replacements: { showId, engine: JSON.stringify(next) } });
  return next;
}

async function enqueue(db, { showId, kind, payload = {}, runAfter = null, maxAttempts = 3 }) {
  if (!KINDS.includes(kind)) throw new QueueError(400, `kind must be one of ${KINDS.join(', ')}.`);
  return db.PulseJob.create({
    show_id: showId, kind, payload_json: payload, status: 'queued', max_attempts: maxAttempts,
    ...(runAfter ? { run_after: runAfter } : {}),
  });
}

const startOfUtcDay = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** Drafts the queue made for the show today (UTC). */
async function draftsToday(db, showId, now = new Date()) {
  const [[row]] = await db.sequelize.query(
    `SELECT COALESCE(SUM(jsonb_array_length(draft_ids)), 0)::int AS n FROM pulse_jobs
      WHERE show_id = :showId AND status = 'done' AND finished_at >= :since AND deleted_at IS NULL`,
    { replacements: { showId, since: startOfUtcDay(now) } });
  return row.n;
}

/**
 * The engine's state for Admin: settings, completed episodes with no event
 * posts queued (Task #3049), today's requests by lane, today's drafts, the last jobs.
 */
async function stateOf(db, showId, now = new Date()) {
  const settings = await settingsOf(db, showId);
  const requests = await require('./pulseRequests').usedToday(db, showId, now);
  const jobs = await db.PulseJob.findAll({ where: { show_id: showId }, order: [['created_at', 'DESC']], limit: 20 });
  return {
    settings,
    episodes_without_posts: await require('./pulseEventPosting').episodesWithoutPosts(db, showId),
    requests_today: requests,
    drafts_today: await draftsToday(db, showId, now),
    worker_enabled: process.env.PULSE_ENGINE_ENABLED === 'true',
    jobs: jobs.map((j) => ({
      id: j.id, kind: j.kind, status: j.status, attempts: j.attempts, error: j.error,
      run_after: j.run_after, started_at: j.started_at, finished_at: j.finished_at,
      drafts: Array.isArray(j.draft_ids) ? j.draft_ids.length : 0, created_at: j.created_at,
    })),
  };
}

/** Puts jobs lost mid-run (a restart) back in the queue. */
async function requeueStale(db, now = new Date()) {
  const [, meta] = await db.sequelize.query(
    `UPDATE pulse_jobs SET status = 'queued', started_at = NULL, updated_at = NOW()
      WHERE status = 'running' AND started_at < :before AND deleted_at IS NULL`,
    { replacements: { before: new Date(now.getTime() - STALE_MS) } });
  return meta?.rowCount ?? 0;
}

/** Claims the next due job, marking it running; null when none is due. */
async function claimNext(db, now = new Date()) {
  const { sequelize, PulseJob } = db;
  const { Op } = require('sequelize');
  return sequelize.transaction(async (transaction) => {
    const job = await PulseJob.findOne({
      where: { status: 'queued', run_after: { [Op.lte]: now } },
      order: [['run_after', 'ASC'], ['created_at', 'ASC']],
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
      transaction,
    });
    if (!job) return null;
    await job.update({ status: 'running', started_at: now, attempts: job.attempts + 1 }, { transaction });
    return job;
  });
}

/** Runs one due job's handler. Returns the job, or null when idle. */
async function runOne(db, { now = new Date() } = {}) {
  const job = await claimNext(db, now);
  if (!job) return null;
  const finish = (fields) => job.update({ finished_at: new Date(), ...fields });
  try {
    const handler = handlers.get(job.kind);
    if (!handler) {
      await finish({ status: 'failed', error: `No handler for ${job.kind} jobs yet.` });
      return job;
    }
    const result = (await handler(db, job)) || {};
    // A handler may decline the job with a reason, e.g. a voice not approved (Task #3029).
    if (result.skipped) {
      await finish({ status: 'skipped', error: String(result.skipped).slice(0, 1000) });
      return job;
    }
    const draftIds = Array.isArray(result.draftIds) ? result.draftIds.map(String) : [];
    // A batch may finish with some items not drafted (Task #3032): kept on the job, which is still done.
    const failed = Array.isArray(result.failed) ? result.failed.filter(Boolean).map(String) : [];
    await finish({ status: 'done', error: failed.length ? failed.join(' ').slice(0, 1000) : null, draft_ids: draftIds });
  } catch (err) {
    // The lane's requests for today are used (pulseRequests.take). An event's
    // posts and their replies wait for the reset, the same job, the wait not
    // counted as an attempt (Task #3049); any other kind is skipped, not retried.
    const requests = require('./pulseRequests');
    if (err instanceof requests.RequestCapError) {
      if (WAIT_ON_CAP.includes(job.kind)) {
        const runAfter = new Date(requests.nextReset(now).getTime() + CAP_WAIT_MS);
        console.error(`[PulseQueue] ${job.kind} job ${job.id} waits until ${runAfter.toISOString()}:`, err.message);
        await job.update({ status: 'queued', started_at: null, attempts: Math.max(0, job.attempts - 1), run_after: runAfter, error: `Waiting for tomorrow's requests. ${err.message}`.slice(0, 1000) });
        return job;
      }
      console.error(`[PulseQueue] ${job.kind} job ${job.id} skipped:`, err.message);
      await finish({ status: 'skipped', error: err.message });
      return job;
    }
    console.error(`[PulseQueue] ${job.kind} job ${job.id} failed (attempt ${job.attempts}):`, err);
    const message = String(err?.message || err).slice(0, 1000);
    if (job.attempts < job.max_attempts) {
      await job.update({ status: 'queued', started_at: null, error: message, run_after: new Date(now.getTime() + BACKOFF_MS * job.attempts ** 2) });
    } else {
      await finish({ status: 'failed', error: message });
    }
  }
  return job;
}

let timer = null;
let busy = false;

/** One pass: stale jobs back in the queue, then every due job in turn. */
async function tick(db) {
  if (busy) return;
  busy = true;
  try {
    await requeueStale(db);
    while (await runOne(db)) { /* run until idle */ }
  } catch (err) {
    console.error('[PulseQueue] the worker pass failed:', err);
  } finally {
    busy = false;
  }
}

/** Starts the worker loop (app.js, only when PULSE_ENGINE_ENABLED === 'true'). */
function start(db = require('../models'), { intervalMs = POLL_MS } = {}) {
  if (timer) return false;
  timer = setInterval(() => { tick(db); }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`[PulseQueue] worker started, polling every ${intervalMs}ms`);
  return true;
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  KINDS, DEFAULTS, MAX_CAP, BACKOFF_MS, STALE_MS, WAIT_ON_CAP, CAP_WAIT_MS,
  register, unregister, settingsOf, saveSettings, enqueue, draftsToday, stateOf, requeueStale, claimNext, runOne, tick, start, stop, QueueError,
};
