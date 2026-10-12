'use strict';

/**
 * The Pulse's posting queue and daily draft cap (Task #2968; The Pulse spec
 * §7 "Cost control: a daily generation cap; jobs run through a queue, never
 * in a live request"; docs/reads/2026-10-12-pulse-posting-read.md §4-5).
 * Evoni, 2026-10-12: the cap counts drafts per day, set in Admin; the
 * ambient worker ships off.
 *
 *   settingsOf(db, showId)        { daily_draft_cap, ambient_enabled } from
 *                                 the show's metadata.pulse_engine, defaults
 *                                 filled in
 *   saveSettings(db, showId, …)   writes only metadata.pulse_engine
 *   enqueue(db, { showId, kind, payload, runAfter })
 *   draftsToday(db, showId)       drafts the queue made today (UTC)
 *   runOne(db, { now })           claims the next due job (skipLocked, as
 *                                 workers/sceneGenerationWorker.js), skips it
 *                                 if the cap is spent, runs its handler,
 *                                 retries with a backoff; null when idle
 *   register(kind, handler)       handler(db, job) → { draftIds }; the
 *                                 drafting handlers come with #2969-#2971
 *   start() / stop()              the worker loop; app.js starts it only
 *                                 when PULSE_ENGINE_ENABLED === 'true'
 *
 * Every AI call a handler makes still passes aiCostTracker's global budget;
 * the draft cap sits inside it.
 */

const KINDS = ['event', 'ambient', 'comment', 'dm'];   // dm: Task #2984
const DEFAULTS = { daily_draft_cap: 30, ambient_enabled: false };
const MAX_CAP = 500;
const BACKOFF_MS = 60 * 1000;            // 1, 4, 9 minutes …
const STALE_MS = 15 * 60 * 1000;         // a job running this long was lost
const POLL_MS = parseInt(process.env.PULSE_ENGINE_POLL_MS, 10) || 15000;

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
  return {
    daily_draft_cap: Number.isInteger(saved.daily_draft_cap) ? saved.daily_draft_cap : DEFAULTS.daily_draft_cap,
    ambient_enabled: typeof saved.ambient_enabled === 'boolean' ? saved.ambient_enabled : DEFAULTS.ambient_enabled,
  };
}

/** Saves the settings given (others kept), only under metadata.pulse_engine. */
async function saveSettings(db, showId, { daily_draft_cap: cap, ambient_enabled: ambient } = {}) {
  const current = await settingsOf(db, showId);
  if (cap !== undefined && (!Number.isInteger(cap) || cap < 0 || cap > MAX_CAP)) {
    throw new QueueError(400, `The daily cap must be a whole number from 0 to ${MAX_CAP}.`);
  }
  if (ambient !== undefined && typeof ambient !== 'boolean') throw new QueueError(400, 'ambient_enabled must be true or false.');
  const next = { ...current, ...(cap !== undefined ? { daily_draft_cap: cap } : {}), ...(ambient !== undefined ? { ambient_enabled: ambient } : {}) };
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

/** The engine's state for Admin: settings, today's drafts against the cap, the last jobs. */
async function stateOf(db, showId, now = new Date()) {
  const settings = await settingsOf(db, showId);
  const today = await draftsToday(db, showId, now);
  const jobs = await db.PulseJob.findAll({ where: { show_id: showId }, order: [['created_at', 'DESC']], limit: 20 });
  return {
    settings,
    drafts_today: today,
    cap_left: Math.max(0, settings.daily_draft_cap - today),
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

/** Runs one due job: the cap first, then its handler. Returns the job, or null when idle. */
async function runOne(db, { now = new Date() } = {}) {
  const job = await claimNext(db, now);
  if (!job) return null;
  const finish = (fields) => job.update({ finished_at: new Date(), ...fields });
  try {
    const { daily_draft_cap: cap } = await settingsOf(db, job.show_id);
    const made = await draftsToday(db, job.show_id, now);
    // Other jobs running now may each make a draft: count them, so two workers cannot pass the cap together.
    const [[{ running }]] = await db.sequelize.query(
      `SELECT COUNT(*)::int AS running FROM pulse_jobs
        WHERE show_id = :showId AND status = 'running' AND id <> :id AND deleted_at IS NULL`,
      { replacements: { showId: job.show_id, id: job.id } });
    if (made + running >= cap) {
      await finish({ status: 'skipped', error: `The daily draft cap (${cap}) was reached for today.` });
      return job;
    }
    const handler = handlers.get(job.kind);
    if (!handler) {
      await finish({ status: 'failed', error: `No handler for ${job.kind} jobs yet.` });
      return job;
    }
    const result = (await handler(db, job)) || {};
    const draftIds = Array.isArray(result.draftIds) ? result.draftIds.map(String) : [];
    await finish({ status: 'done', error: null, draft_ids: draftIds });
  } catch (err) {
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
  KINDS, DEFAULTS, MAX_CAP, BACKOFF_MS, STALE_MS,
  register, unregister, settingsOf, saveSettings, enqueue, draftsToday, stateOf, requeueStale, claimNext, runOne, tick, start, stop, QueueError,
};
