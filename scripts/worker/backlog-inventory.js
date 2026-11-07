#!/usr/bin/env node
/**
 * scripts/worker/backlog-inventory.js: a read-only inventory of what the
 * episode worker would do if it were switched on (issue #3714, Phase 1). It
 * starts no worker, claims no job and changes nothing.
 *
 *   node scripts/worker/backlog-inventory.js            text report
 *   node scripts/worker/backlog-inventory.js --json     the same as JSON
 *   options: --limit N (open rows listed, default 200), --failed N (recent
 *            failed rows listed, default 20), --no-redis (skip the queue)
 *
 * Database: it connects once as the worker's own login, read from the
 * worker's credential file with the worker's loader (the same settings as
 * scripts/worker/check-db-access.js), in a read-only session
 * (default_transaction_read_only, inside a READ ONLY transaction that is
 * rolled back). Every statement is a SELECT (INVENTORY_QUERIES); none locks
 * rows. It reads generation_jobs, scene_sets, scene_angles and ai_usage_logs.
 *
 * Redis (the Bull "video-export" queue): a minimal client that can send only
 * AUTH, PING, LLEN, ZCARD, SCARD and EXISTS (ALLOWED_REDIS_COMMANDS). Any
 * other command is refused before anything is written to the socket, so it
 * cannot take, move, retry or delete a job.
 *
 * Output: counts, job and scene ids, types, ages, attempts, scene states and
 * spend figures. Never a password, a host, a payload or a raw error message
 * (errors are shortened with URLs and token-like strings removed).
 * Complete means every section was read. A section not read (a query
 * failed, Redis unreachable or skipped with --no-redis, or no Bull keys at
 * all) makes the report INCOMPLETE, with a banner at the top and bottom
 * naming it: a missing section is never shown as zero.
 * Exit codes: 0 complete; 1 incomplete; 2 the settings or the database
 * connection failed (no report is produced).
 *
 * Importing this file loads only net, pg (in main) and the preflight's
 * settings helpers: no model, worker, queue, Bull, Redis client library,
 * renderer or AI SDK (tested).
 */
'use strict';

const net = require('net');

// ─── What the worker would do (src/workers/sceneGenerationWorker.js) ─────────

const LEGACY_JOB_TYPES = Object.freeze(['generate_base', 'generate_angle', 'regenerate_angle']);
const CURRENT_JOB_TYPES = Object.freeze(['generate_angle_video', 'cascade_regenerate']);
// generationClaimService.GENERATION_STALE_MINUTES: a set or angle claim older
// than this is treated as dead.
const CLAIM_STALE_MINUTES = 15;

// ─── The database queries: SELECT only ──────────────────────────────────────

const INVENTORY_QUERIES = Object.freeze({
  summary: `
    SELECT j.status::text AS status, j.job_type::text AS job_type, j.max_attempts,
           (j.deleted_at IS NOT NULL) AS deleted, count(*)::int AS n,
           min(j.created_at) AS oldest, max(j.created_at) AS newest
      FROM generation_jobs j
     GROUP BY 1, 2, 3, 4
     ORDER BY 1, 2, 3, 4`,
  open: `
    SELECT j.id, j.status::text AS status, j.job_type::text AS job_type, j.attempts, j.max_attempts,
           j.priority, j.created_at, j.started_at, j.updated_at, j.scene_set_id, j.scene_angle_id,
           COALESCE(j.payload ? 'overrides', false) AS has_overrides,
           COALESCE(j.payload ? 'event_id', false) AS has_event,
           COALESCE(j.payload->>'force' = 'true', false) AS force,
           (s.id IS NULL) AS set_missing, (s.deleted_at IS NOT NULL) AS set_deleted,
           s.generation_status::text AS set_status, s.updated_at AS set_updated_at,
           (s.base_still_url IS NOT NULL) AS set_has_base,
           (j.scene_angle_id IS NOT NULL AND a.id IS NULL) AS angle_missing,
           (a.deleted_at IS NOT NULL) AS angle_deleted,
           a.angle_label, a.generation_status::text AS angle_status, a.updated_at AS angle_updated_at,
           (a.still_image_url IS NOT NULL) AS angle_has_still, (a.video_clip_url IS NOT NULL) AS angle_has_video
      FROM generation_jobs j
      LEFT JOIN scene_sets s ON s.id = j.scene_set_id
      LEFT JOIN scene_angles a ON a.id = j.scene_angle_id
     WHERE j.deleted_at IS NULL AND j.status IN ('queued', 'processing')
     ORDER BY j.priority DESC, j.created_at ASC
     LIMIT $1`,
  fates: `
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status = 'queued' AND attempts < max_attempts)::int AS would_run,
           count(*) FILTER (WHERE status = 'processing' AND attempts < max_attempts)::int AS requeued_then_run,
           count(*) FILTER (WHERE status = 'processing' AND attempts >= max_attempts)::int AS marked_failed,
           count(*) FILTER (WHERE status = 'queued' AND attempts >= max_attempts)::int AS never_claimed,
           count(*) FILTER (WHERE status = 'processing')::int AS uncertain_paid,
           count(*) FILTER (WHERE NOT (job_type::text = ANY($1::text[])) OR max_attempts > 1)::int AS legacy_open
      FROM generation_jobs
     WHERE deleted_at IS NULL AND status IN ('queued', 'processing')`,
  failed: `
    SELECT j.id, j.job_type::text AS job_type, j.attempts, j.max_attempts, j.created_at, j.completed_at,
           j.error, j.scene_set_id, j.scene_angle_id
      FROM generation_jobs j
     WHERE j.deleted_at IS NULL AND j.status = 'failed'
     ORDER BY COALESCE(j.completed_at, j.updated_at) DESC
     LIMIT $1`,
  spend: `
    SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           count(*)::int AS calls,
           COALESCE(sum(cost_usd), 0)::float AS total_usd,
           COALESCE(sum(cost_usd) FILTER (WHERE billing_unit IS NOT NULL), 0)::float AS image_usd,
           count(*) FILTER (WHERE billing_unit IS NOT NULL)::int AS image_calls,
           count(*) FILTER (WHERE cost_usd IS NULL)::int AS unpriced_calls,
           count(*) FILTER (WHERE provider = 'runway')::int AS runway_calls,
           count(*) FILTER (WHERE is_error)::int AS error_calls
      FROM ai_usage_logs
     WHERE created_at >= $1
     GROUP BY 1
     ORDER BY 1 DESC`,
});

// ─── Classification (pure) ──────────────────────────────────────────────────

const minutesSince = (t, now) => (t ? (now.getTime() - new Date(t).getTime()) / 60000 : null);

/** What the worker would do with one open job, and what to look at. */
function classifyJob(row, now = new Date()) {
  const ageMin = minutesSince(row.created_at, now);
  const queued = row.status === 'queued';
  const processing = row.status === 'processing';
  const flags = [];
  let ifEnabled;
  if (queued && row.attempts < row.max_attempts) ifEnabled = 'would run';
  else if (queued) ifEnabled = 'never claimed (attempts used up; stays queued)';
  else if (processing && row.attempts < row.max_attempts) ifEnabled = 're-queued by recovery, then run again';
  else if (processing) ifEnabled = 'marked failed by recovery';
  else ifEnabled = 'none';

  const legacy = LEGACY_JOB_TYPES.includes(row.job_type) || !CURRENT_JOB_TYPES.includes(row.job_type) || row.max_attempts > 1;
  if (legacy) flags.push('legacy');
  if (processing) flags.push('uncertain-paid');
  if (queued && row.attempts >= row.max_attempts) flags.push('never-claimable');
  if (row.max_attempts > 1 && (queued || processing)) flags.push('paid-retries');
  if (row.set_missing || row.set_deleted || row.angle_missing || row.angle_deleted) flags.push('target-gone');
  if (row.job_type === 'cascade_regenerate' && queued && ageMin !== null && ageMin > CLAIM_STALE_MINUTES) flags.push('stale-cascade');
  const setClaimAge = minutesSince(row.set_updated_at, now);
  if (row.set_status === 'generating' && setClaimAge !== null && setClaimAge < CLAIM_STALE_MINUTES) flags.push('set-claim-live');
  if (row.job_type === 'cascade_regenerate' && row.force) flags.push('force');
  if (ageMin !== null && ageMin > 24 * 60) flags.push('older-than-24h');

  return { ageMinutes: ageMin === null ? null : Math.round(ageMin), ifEnabled, flags };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY = '(?:x-amz-[a-z-]+|signature|sig|access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|key|client[_-]?secret|secret|password|passwd|pwd|pass|authorization|auth|credentials?|session(?:[_-]?id)?|cookie|set-cookie|expires)';

/**
 * Error text shortened, with anything that could identify or unlock
 * something removed: URLs (signed ones included), user:password@ strings,
 * key=value / "key":"value" / header pairs with a sensitive key, bearer and
 * basic credentials, JWTs, AWS key ids, e-mail addresses, host names, IP
 * addresses and long token-like strings (UUIDs are kept: they are job and
 * scene ids). Control characters and line breaks are flattened first, and
 * non-string values are stringified, so an unusual format is still covered.
 */
function redactError(text, max = 120) {
  if (text === null || text === undefined) return '';
  let s;
  if (typeof text === 'string') s = text;
  else {
    try { s = JSON.stringify(text); } catch { s = String(text); }
  }
  s = String(s)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, '<url>')
    .replace(/[^\s"'<>]+:[^\s"'<>@]+@[^\s"'<>]+/g, '<credential>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(new RegExp(`(["']?)\\b${SENSITIVE_KEY}\\1\\s*[:=]\\s*(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s"',;&}]+)`, 'gi'), '<redacted>')
    .replace(/\b(bearer|basic|token|key)\s+[^\s"',;]+/gi, '$1 <redacted>')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<redacted>')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '<redacted>')
    .replace(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ai|dev|run|cloud|app|co|internal|local|amazonaws\.com)(?::\d+)?(?:\/[^\s"'<>]*)?/gi, '<host>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<ip>')
    .replace(/[A-Za-z0-9_\-+/=]{20,}/g, (m) => (UUID_RE.test(m) || !/\d/.test(m) || !/[A-Za-z]/.test(m) ? m : '<redacted>'))
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function utcDaysBack(now, days) {
  const start = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(start.getTime() - days * 24 * 3600 * 1000);
}

/**
 * The database part of the inventory. The caller owns the read-only session
 * (main(); the integration test does the same).
 */
async function collectDbInventory(client, { now = new Date(), limit = 200, failedLimit = 20 } = {}) {
  const [summary, open, fates, failed, spend] = [
    await client.query(INVENTORY_QUERIES.summary),
    await client.query(INVENTORY_QUERIES.open, [limit]),
    await client.query(INVENTORY_QUERIES.fates, [CURRENT_JOB_TYPES]),
    await client.query(INVENTORY_QUERIES.failed, [failedLimit]),
    await client.query(INVENTORY_QUERIES.spend, [utcDaysBack(now, 6)]),
  ];
  const openRows = open.rows.map((r) => ({ ...r, ...classifyJob(r, now) }));
  const live = summary.rows.filter((r) => !r.deleted);
  const count = (pred) => live.filter(pred).reduce((a, r) => a + r.n, 0);
  return {
    summary: summary.rows,
    totals: {
      queued: count((r) => r.status === 'queued'),
      processing: count((r) => r.status === 'processing'),
      failed: count((r) => r.status === 'failed'),
      completed: count((r) => r.status === 'completed'),
      softDeleted: summary.rows.filter((r) => r.deleted).reduce((a, r) => a + r.n, 0),
      legacyOpen: fates.rows[0].legacy_open,
    },
    open: { total: fates.rows[0].total, listed: openRows.length, truncated: openRows.length < fates.rows[0].total, rows: openRows },
    // Counted over every open job in SQL, never from the (limited) listed rows.
    ifEnabled: {
      wouldRun: fates.rows[0].would_run,
      requeuedThenRun: fates.rows[0].requeued_then_run,
      markedFailed: fates.rows[0].marked_failed,
      neverClaimed: fates.rows[0].never_claimed,
      uncertainPaid: fates.rows[0].uncertain_paid,
    },
    failed: failed.rows.map((r) => ({
      id: r.id, job_type: r.job_type, attempts: r.attempts, max_attempts: r.max_attempts,
      created_at: r.created_at, completed_at: r.completed_at, scene_set_id: r.scene_set_id,
      scene_angle_id: r.scene_angle_id, error: redactError(r.error),
    })),
    spend: spend.rows,
  };
}

// ─── Redis: a read-only RESP client ─────────────────────────────────────────

const ALLOWED_REDIS_COMMANDS = Object.freeze(['AUTH', 'PING', 'LLEN', 'ZCARD', 'SCARD', 'EXISTS']);

function encodeCommand(args) {
  return `*${args.length}\r\n${args.map((a) => { const b = Buffer.from(String(a)); return `$${b.length}\r\n${b}\r\n`; }).join('')}`;
}

/** One RESP reply from buf at offset, or null if incomplete: { value, next } or { error, next }. */
function parseReply(buf, offset = 0) {
  const end = buf.indexOf('\r\n', offset);
  if (end < 0) return null;
  const type = String.fromCharCode(buf[offset]);
  const line = buf.toString('utf8', offset + 1, end);
  const next = end + 2;
  if (type === '+') return { value: line, next };
  if (type === '-') return { error: line, next };
  if (type === ':') return { value: Number(line), next };
  if (type === '$') {
    const len = Number(line);
    if (len < 0) return { value: null, next };
    if (buf.length < next + len + 2) return null;
    return { value: buf.toString('utf8', next, next + len), next: next + len + 2 };
  }
  if (type === '*') {
    const n = Number(line);
    const items = [];
    let at = next;
    for (let i = 0; i < n; i += 1) {
      const r = parseReply(buf, at);
      if (!r) return null;
      items.push(r.error ? new Error(r.error) : r.value);
      at = r.next;
    }
    return { value: items, next: at };
  }
  return { error: `unexpected reply type ${JSON.stringify(type)}`, next };
}

class ReadOnlyRedis {
  constructor({ host = '127.0.0.1', port = 6379, timeoutMs = 5000, connect = net.connect } = {}) {
    this.opts = { host, port, timeoutMs, connect };
    this.sent = [];
    this.socket = null;
    this.buf = Buffer.alloc(0);
    this.waiting = [];
  }

  open() {
    return new Promise((resolve, reject) => {
      const s = this.opts.connect({ host: this.opts.host, port: this.opts.port });
      this.socket = s;
      const t = setTimeout(() => { s.destroy(); reject(new Error('Redis connection timed out')); }, this.opts.timeoutMs);
      s.once('connect', () => { clearTimeout(t); resolve(); });
      s.once('error', (err) => { clearTimeout(t); reject(new Error(`Redis connection failed (${err.code || 'error'})`)); });
      s.on('data', (d) => this.onData(d));
      s.on('error', (err) => { for (const w of this.waiting.splice(0)) w.reject(new Error(`Redis error (${err.code || 'error'})`)); });
    });
  }

  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (!this.waiting.length) return;
      const r = parseReply(this.buf);
      if (!r) return;
      this.buf = this.buf.subarray(r.next);
      const w = this.waiting.shift();
      clearTimeout(w.timer);
      if (r.error !== undefined) w.reject(new Error(`Redis replied with an error to ${w.name}`));
      else w.resolve(r.value);
    }
  }

  /** Sends one allowed command; refuses every other one before writing anything. */
  command(name, ...args) {
    const upper = String(name).toUpperCase();
    if (!ALLOWED_REDIS_COMMANDS.includes(upper)) {
      return Promise.reject(new Error(`refused: ${upper} is not a read-only inventory command`));
    }
    if (!this.socket) return Promise.reject(new Error('Redis is not connected'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Redis ${upper} timed out`)), this.opts.timeoutMs);
      this.waiting.push({ name: upper, resolve, reject, timer });
      this.sent.push(upper);
      this.socket.write(encodeCommand([upper, ...args]));
    });
  }

  close() {
    if (this.socket) this.socket.destroy();
    this.socket = null;
  }
}

// Bull 3 keys for a queue (prefix "bull", the default used by src/queues/videoQueue.js).
const BULL_KEYS = Object.freeze([
  ['wait', 'LLEN'], ['active', 'LLEN'], ['paused', 'LLEN'],
  ['delayed', 'ZCARD'], ['priority', 'ZCARD'], ['failed', 'ZCARD'], ['completed', 'ZCARD'],
  ['stalled', 'SCARD'],
]);

async function collectRedisInventory(redis, { prefix = 'bull', queue = 'video-export', password } = {}) {
  if (password) await redis.command('AUTH', password);
  await redis.command('PING');
  const counts = {};
  for (const [suffix, cmd] of BULL_KEYS) {
    counts[suffix] = Number(await redis.command(cmd, `${prefix}:${queue}:${suffix}`)) || 0;
  }
  const paused = Number(await redis.command('EXISTS', `${prefix}:${queue}:meta-paused`)) === 1;
  // Bull creates :id when the first job is ever added. No key at all means
  // the queue was never used, or the prefix, name or database is not the one
  // the app uses: zero cannot be told apart from "looked in the wrong place".
  const keysFound = Number(await redis.command('EXISTS', ...[...BULL_KEYS.map(([k]) => k), 'id', 'meta-paused'].map((k) => `${prefix}:${queue}:${k}`))) || 0;
  return {
    queue,
    keysFound,
    counts,
    queuePaused: paused,
    wouldProcessOnEnable: counts.wait + counts.delayed + counts.priority + counts.active,
  };
}

// ─── The report ─────────────────────────────────────────────────────────────

function formatReport(inv) {
  const out = [];
  const iso = (t) => (t ? new Date(t).toISOString().replace('.000Z', 'Z') : '-');
  const age = (m) => (m === null || m === undefined ? '-' : m < 120 ? `${m}m` : m < 48 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`);
  const banner = () => {
    if (inv.complete) return;
    out.push('*** INCOMPLETE INVENTORY. Not read:');
    for (const m of inv.incompleteSections || []) out.push(`***   ${m.section}: ${m.reason}`);
    out.push('*** A section that was not read is NOT zero. Do not use this report to approve activation. ***');
  };
  out.push(`EPISODE WORKER BACKLOG INVENTORY (read-only)  at ${iso(inv.at)}`);
  banner();
  if (inv.db) {
    const t = inv.db.totals;
    out.push('', 'generation_jobs totals (not soft-deleted):');
    out.push(`  queued ${t.queued} | processing ${t.processing} | failed ${t.failed} | completed ${t.completed} | soft-deleted rows ${t.softDeleted}`);
    out.push('', 'By status / type / max_attempts:');
    for (const r of inv.db.summary) {
      out.push(`  ${r.deleted ? '(deleted) ' : ''}${r.status.padEnd(10)} ${r.job_type.padEnd(22)} max_attempts=${r.max_attempts}  n=${r.n}  oldest ${iso(r.oldest)}  newest ${iso(r.newest)}${LEGACY_JOB_TYPES.includes(r.job_type) ? '  [legacy type]' : ''}`);
    }
    const e = inv.db.ifEnabled;
    out.push('', 'If GENERATION_WORKER_ENABLED were true now:');
    out.push(`  would run: ${e.wouldRun} | re-queued by recovery then run: ${e.requeuedThenRun} | marked failed by recovery: ${e.markedFailed} | never claimed: ${e.neverClaimed}`);
    out.push(`  uncertain paid (left processing): ${e.uncertainPaid} | legacy open: ${t.legacyOpen}`);
    out.push('', `Open jobs (queued / processing), in claim order: ${inv.db.open.listed} listed of ${inv.db.open.total}`);
    if (inv.db.open.truncated) out.push(`  LIST TRUNCATED by --limit: ${inv.db.open.total - inv.db.open.listed} open jobs not listed; the counts above cover all ${inv.db.open.total}.`);
    for (const r of inv.db.open.rows) {
      out.push(`  ${r.id}  ${r.status.padEnd(10)} ${r.job_type.padEnd(22)} attempts ${r.attempts}/${r.max_attempts}  prio ${r.priority}  age ${age(r.ageMinutes)}`);
      out.push(`      set ${r.scene_set_id} (${r.set_missing ? 'missing' : `${r.set_deleted ? 'deleted, ' : ''}${r.set_status || 'no status'}, base ${r.set_has_base ? 'yes' : 'no'}`})` +
        (r.scene_angle_id ? `  angle ${r.scene_angle_id} (${r.angle_missing ? 'missing' : `${r.angle_deleted ? 'deleted, ' : ''}${r.angle_label || '?'} ${r.angle_status || 'no status'}, still ${r.angle_has_still ? 'yes' : 'no'}, video ${r.angle_has_video ? 'yes' : 'no'}`})` : ''));
      out.push(`      if enabled: ${r.ifEnabled}${r.flags.length ? `  flags: ${r.flags.join(', ')}` : ''}`);
    }
    out.push('', `Recent failed jobs (${inv.db.failed.length}):`);
    for (const r of inv.db.failed) {
      out.push(`  ${r.id}  ${r.job_type.padEnd(22)} attempts ${r.attempts}/${r.max_attempts}  failed ${iso(r.completed_at)}  ${r.error ? `error: ${r.error}` : ''}`);
    }
    out.push('', 'AI spend, last 7 UTC days (ai_usage_logs):');
    if (!inv.db.spend.length) out.push('  no rows');
    for (const r of inv.db.spend) {
      out.push(`  ${r.day}  calls ${r.calls}  total $${r.total_usd.toFixed(2)}  image $${r.image_usd.toFixed(2)} (${r.image_calls} calls)  unpriced ${r.unpriced_calls}  runway ${r.runway_calls}  errors ${r.error_calls}`);
    }
    if (inv.budgets) out.push(`  caps as the worker would read them: AI_DAILY_BUDGET_USD $${inv.budgets.total}  AI_DAILY_IMAGE_BUDGET_USD $${inv.budgets.image}  (Runway calls are unpriced: they add $0)`);
  } else {
    out.push('', `generation_jobs, scenes and AI spend: NOT READ (${inv.dbError}): these counts are UNKNOWN, not zero`);
  }
  out.push('', 'Redis video-export queue:');
  if (inv.redis) {
    const c = inv.redis.counts;
    out.push(`  wait ${c.wait} | active ${c.active} | delayed ${c.delayed} | priority ${c.priority} | paused ${c.paused} | failed ${c.failed} | completed ${c.completed} | stalled ${c.stalled}`);
    out.push(`  queue paused: ${inv.redis.queuePaused ? 'yes' : 'no'} | would be picked up when the worker loads: ${inv.redis.wouldProcessOnEnable}`);
    if (!inv.redis.keysFound) out.push('  NO KEYS FOUND for this queue: the zeros above are UNVERIFIED (never used, or a different prefix or database).');
  } else {
    out.push(`  NOT READ (${inv.redisSkipped ? 'skipped by --no-redis' : inv.redisError}): these counts are UNKNOWN, not zero`);
  }
  out.push('');
  banner();
  out.push(inv.complete ? 'RESULT: COMPLETE (nothing was written)' : 'RESULT: INCOMPLETE (nothing was written)');
  return out.join('\n');
}

// ─── main ───────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { json: false, limit: 200, failedLimit: 20, redis: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--no-redis') opts.redis = false;
    else if (a === '--limit') opts.limit = Math.max(1, Math.min(5000, Number(argv[++i]) || 200));
    else if (a === '--failed') opts.failedLimit = Math.max(0, Math.min(500, Number(argv[++i]) || 0));
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

async function main(argv = process.argv.slice(2), { env = process.env, log = console.log, err = console.error } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { err(`FAIL settings: ${e.message}`); return 2; }
  const { readSettingsEnv, readCredentials, loadSettings } = require('./check-db-access');
  const settingsEnv = readSettingsEnv(env);
  const settings = loadSettings(settingsEnv, readCredentials(settingsEnv));
  if (settings.error) { err(`FAIL settings: ${settings.error}`); return 2; }

  const inv = { at: new Date(), complete: true, incompleteSections: [] };
  const incomplete = (section, reason) => { inv.complete = false; inv.incompleteSections.push({ section, reason }); };
  inv.budgets = {
    total: parseFloat(settingsEnv.AI_DAILY_BUDGET_USD) || 50,
    image: parseFloat(settingsEnv.AI_DAILY_IMAGE_BUDGET_USD) || 10,
  };

  const { Client } = require('pg');
  const client = new Client({ ...settings.config, application_name: 'episode-worker-inventory' });
  try {
    await client.connect();
  } catch (e) {
    err(`FAIL connect: as ${settings.user}: ${e.code || ''} ${redactError(e.message, 160)}`.trim());
    err('INVENTORY NOT PRODUCED: the database could not be reached, so nothing below it is known.');
    return 2;
  }
  try {
    await client.query('SET default_transaction_read_only = on');
    await client.query("SET statement_timeout = '15s'");
    await client.query('BEGIN READ ONLY');
    try {
      inv.db = await collectDbInventory(client, { now: inv.at, limit: opts.limit, failedLimit: opts.failedLimit });
    } finally {
      await client.query('ROLLBACK');
    }
  } catch (e) {
    inv.dbError = `query failed: ${e.code || ''} ${redactError(e.message, 160)}`.replace(/\s+/g, ' ').trim();
    incomplete('database', inv.dbError);
  } finally {
    await client.end().catch((e) => err(`[backlog-inventory] close failed: ${e.message}`));
  }

  if (!opts.redis) {
    inv.redisSkipped = true;
    incomplete('redis video-export queue', 'skipped by --no-redis');
  } else {
    const redis = new ReadOnlyRedis({ host: settingsEnv.REDIS_HOST || '127.0.0.1', port: Number(settingsEnv.REDIS_PORT) || 6379 });
    try {
      await redis.open();
      inv.redis = await collectRedisInventory(redis, { password: settingsEnv.REDIS_PASSWORD || undefined });
      if (!inv.redis.keysFound) incomplete('redis video-export queue', 'no Bull keys found (never used, or a different prefix or database): zero is unverified');
    } catch (e) {
      inv.redisError = redactError(e.message, 160);
      incomplete('redis video-export queue', inv.redisError);
    } finally {
      redis.close();
    }
  }

  log(opts.json ? JSON.stringify(inv, null, 2) : formatReport(inv));
  return inv.complete ? 0 : 1;
}

if (require.main === module) {
  main().then((code) => process.exit(code), (e) => {
    console.error(`FAIL: ${e.message}`);
    process.exit(2);
  });
}

module.exports = {
  INVENTORY_QUERIES, UUID_RE, LEGACY_JOB_TYPES, CURRENT_JOB_TYPES, ALLOWED_REDIS_COMMANDS, BULL_KEYS,
  classifyJob, redactError, collectDbInventory, collectRedisInventory, formatReport, parseArgs, parseReply,
  encodeCommand, ReadOnlyRedis, main,
};
