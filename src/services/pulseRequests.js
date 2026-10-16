'use strict';

/**
 * The Pulse's daily request ledger (Task #3031; Evoni, 2026-10-12: "20 AI
 * text-generation requests per show. Start with 5 automated requests, leaving
 * 15 for manual work. Each request can draft a small batch of posts or
 * replies. Count regenerations; saved-content views don't count";
 * docs/reads/2026-10-12-pulse-decisions-read.md §3).
 *
 *   take(db, { showId, lane, kind, jobId })  records one request, or throws
 *       a RequestCapError (429) when the lane's limit for today (UTC) is
 *       used; called right before every drafting call
 *   usedToday(db, showId, now)  { automated, manual } taken today (UTC)
 *   assertRoom(db, showId, lane)  the same refusal, without taking one: for
 *       work queued now and drafted later (a DM)
 *
 * Lanes:
 *   automated  the queue's event, ambient, comment and storyline drafts, and
 *              a new Active character's voice build (Task #3070)
 *   manual     what Evoni starts: DMs, draft reactions, redraft, building a
 *              voice, storyline beat suggestions, a character's posts from
 *              their page (services/characterPosts)
 *
 * One request is one drafting call, however many items it drafts and
 * whichever model of the two-attempt loop answers. The quality gate
 * (services/pulseGate.js) takes none. The limits live in the show's engine
 * settings (services/pulseQueue.js settingsOf). Every call still passes
 * aiCostTracker's global budget; images have their own
 * (AI_DAILY_IMAGE_BUDGET_USD).
 */

const LANES = ['automated', 'manual'];

class RequestCapError extends Error {
  constructor(lane, limit) {
    super(limit === 0
      ? `${lane === 'manual' ? 'Manual' : 'Automated'} requests are set to 0 a day in Admin › The Pulse › Engine.`
      : `Today's ${limit} ${lane} request${limit === 1 ? ' is used; it resets' : 's are used; they reset'} at midnight UTC.`);
    this.status = 429;
    this.code = 'PULSE_REQUESTS_USED';
    this.lane = lane;
  }
}

/**
 * A SQL test, on pulse_jobs (alias optional), true for a job the queue skipped because its
 * lane was used up: its error is a RequestCapError message above. Since
 * Task #3049 an event or comment job waits for the reset instead, but jobs
 * skipped before then stay in the table.
 */
const capSkipSql = (alias = '') => {
  const a = alias ? `${alias}.` : '';
  return `(${a}status = 'skipped' AND (${a}error LIKE 'Today''s % request% used%' OR ${a}error LIKE '% requests are set to 0 a day%'))`;
};

/** The next midnight UTC after now: when a lane's requests reset. */
const nextReset = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

const startOfUtcDay = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const limitKey = (lane) => `${lane}_requests`;

/** Requests the show took today (UTC), by lane. */
async function usedToday(db, showId, now = new Date()) {
  const [rows] = await db.sequelize.query(
    `SELECT lane, COUNT(*)::int AS n FROM pulse_requests
      WHERE show_id = :showId AND created_at >= :since AND deleted_at IS NULL GROUP BY lane`,
    { replacements: { showId, since: startOfUtcDay(now) } });
  const used = { automated: 0, manual: 0 };
  for (const r of rows) if (LANES.includes(r.lane)) used[r.lane] = r.n;
  return used;
}

/** Throws a RequestCapError when the lane's requests for today are used; takes none. */
async function assertRoom(db, showId, lane, now = new Date()) {
  const settings = await require('./pulseQueue').settingsOf(db, showId);
  const limit = settings[limitKey(lane)];
  if ((await usedToday(db, showId, now))[lane] >= limit) throw new RequestCapError(lane, limit);
}

/**
 * Takes one request in the lane, or throws a RequestCapError. The count and
 * the insert run under one lock per show and lane, so two workers or two
 * clicks cannot both take the last request.
 */
async function take(db, { showId, lane, kind, jobId = null, now = new Date() }) {
  if (!LANES.includes(lane)) throw new Error(`Unknown Pulse request lane: ${lane}`);
  if (!showId) throw new Error('A Pulse request needs its show.');
  const settings = await require('./pulseQueue').settingsOf(db, showId);
  const limit = settings[limitKey(lane)];
  return db.sequelize.transaction(async (transaction) => {
    await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `pulse_requests:${showId}:${lane}` }, transaction });
    const [[{ n }]] = await db.sequelize.query(
      `SELECT COUNT(*)::int AS n FROM pulse_requests
        WHERE show_id = :showId AND lane = :lane AND created_at >= :since AND deleted_at IS NULL`,
      { replacements: { showId, lane, since: startOfUtcDay(now) }, transaction });
    if (n >= limit) throw new RequestCapError(lane, limit);
    return db.PulseRequest.create({ show_id: showId, lane, kind: String(kind).slice(0, 20), job_id: jobId }, { transaction });
  });
}

module.exports = { LANES, RequestCapError, capSkipSql, nextReset, usedToday, assertRoom, take };
