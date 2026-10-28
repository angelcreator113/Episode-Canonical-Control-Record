'use strict';

/**
 * The teleprompter's phone remote (teleprompter_remote_sessions; Teleprompter
 * batch 3, Evoni, 2026-10-20). Raw SQL, like rawClipsService.
 *
 * The desktop (logged in) opens a session and gets a random 32-byte token
 * once; the table keeps only its sha256 (token_hash). The phone, reached by a
 * QR code, sends the token in X-Remote-Token; it is looked up by its hash,
 * and only a live session (not ended, not expired) answers. A phone sees only
 * its own session's state and can only add commands from COMMANDS.
 *
 * The table arrives with 20261020120000-create-teleprompter-remote-and-voice-clips.js,
 * which runs only through the Deploy workflow; until then every call is a
 * 409 that says so (Postgres 42P01).
 */

const crypto = require('crypto');

const TABLE = 'teleprompter_remote_sessions';
const TTL_HOURS = 2;
// A session in use stays open (Teleprompter audit 12): each state the desktop
// sends moves expires_at to TTL_HOURS from then, never past MAX_HOURS from
// when it was opened.
const MAX_HOURS = 8;
const RECENT = 10; // commands kept in last_command.recent
// phone_take_*: the phone records the take itself and the prompter (the
// rig under the glass) counts in, scrolls, pauses and stops with it (Rig
// mode; Evoni, 2026-10-28). Added to the end: the older commands are unchanged.
const COMMANDS = Object.freeze([
  'toggle', 'faster', 'slower', 'next_beat', 'prev_beat', 'bigger', 'smaller', 'record_start', 'record_stop',
  'phone_take_start', 'phone_take_stop', 'phone_take_pause', 'phone_take_resume',
]);
const PERFORMERS = ['justawoman', 'lala', 'guest'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url
const NOT_READY = "The phone remote isn't switched on yet: the database update that adds it (20261020120000) hasn't run.";
const GONE = 'This remote session has ended or expired. Open a new one on the teleprompter.';

class RemoteError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

/** Postgres 42P01 (undefined_table) for this table: the migration has not run. */
const missingTable = (err) => {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const text = String(err?.original?.message || err?.message || '');
  return (code === '42P01' || /relation .* does not exist/i.test(text)) && text.includes(TABLE);
};

/** Runs fn; a missing table becomes a 409 with a plain message (logged). */
async function guarded(what, fn) {
  try {
    return await fn();
  } catch (err) {
    if (missingTable(err)) {
      console.error(`[teleprompterRemote] ${what}: ${TABLE} is missing (migration 20261020120000 not run):`, err.message);
      throw new RemoteError(409, NOT_READY, 'MIGRATION_PENDING');
    }
    throw err;
  }
}

const hashToken = (token) => crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

/**
 * The token from the phone's header. One that is not shaped like ours reads
 * as an ended session (410), the same answer as a wrong one.
 */
function readToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!TOKEN_RE.test(token)) throw new RemoteError(410, GONE, 'SESSION_GONE');
  return token;
}

function readCommand(value) {
  if (!COMMANDS.includes(value)) throw new RemoteError(400, `command must be one of ${COMMANDS.join(', ')}`);
  return value;
}

const num = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};
const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * The desktop's state as kept: only these fields, bounded. running,
 * recording, paused, recordMode, canRecord, reviewing (booleans); beat
 * (number), beatName, pacing, title (short text); scope ('beat' or
 * 'episode', else null); speed, pace, size (numbers). paused and scope are
 * kept so the phone can show PAUSED and "Stop & review" (Teleprompter audit 10).
 *
 * Rig mode (Evoni, 2026-10-28), for a phone that records the take itself:
 * rig, playing, phoneTake (booleans); line (the line on the reading line)
 * and count (the 3-2-1 showing) (numbers); and what the phone needs to save
 * the take as the prompter would: episodeId (a uuid, else null), takeLabel,
 * takeNo, readAs, performer (one of PERFORMERS), startLine.
 */
function readState(body = {}) {
  const s = body && typeof body === 'object' ? body : {};
  const whole = (v, lo, hi) => { const n = v == null || v === '' ? null : num(v, lo, hi); return n == null ? null : Math.round(n); };
  return {
    running: s.running === true,
    recording: s.recording === true,
    paused: s.paused === true,
    recordMode: s.recordMode === true,
    canRecord: s.canRecord === true,
    reviewing: s.reviewing === true,
    beat: num(s.beat, 0, 100000),
    beatName: text(s.beatName, 120),
    title: text(s.title, 160),
    pacing: ['steady', 'lines', 'voice'].includes(s.pacing) ? s.pacing : null,
    scope: ['beat', 'episode'].includes(s.scope) ? s.scope : null,
    speed: num(s.speed, 0, 100),
    pace: num(s.pace, 0, 10),
    size: num(s.size, 0, 400),
    rig: s.rig === true,
    playing: s.playing === true,
    phoneTake: s.phoneTake === true,
    line: whole(s.line, 0, 100000),
    count: whole(s.count, 0, 9),
    episodeId: typeof s.episodeId === 'string' && UUID_RE.test(s.episodeId) ? s.episodeId : null,
    takeLabel: text(s.takeLabel, 200),
    takeNo: whole(s.takeNo, 0, 100000),
    readAs: text(s.readAs, 120),
    performer: PERFORMERS.includes(s.performer) ? s.performer : null,
    startLine: whole(s.startLine, 0, 100000),
  };
}

const PUBLIC_COLUMNS = 'id, episode_id, expires_at, command_seq, state, created_at';

/** Opens a session for userId. Returns { session, token }; the token is never stored. */
async function createSession(sequelize, { userId, episodeId = null }) {
  if (!userId) throw new RemoteError(401, 'Sign in to open a phone remote');
  const episode = episodeId && UUID_RE.test(String(episodeId)) ? String(episodeId) : null;
  const token = newToken();
  return guarded('create', async () => {
    const [[row]] = await sequelize.query(
      `INSERT INTO ${TABLE} (id, user_id, episode_id, token_hash, expires_at, command_seq, created_at, updated_at)
       VALUES (gen_random_uuid(), :userId, :episodeId, :tokenHash, NOW() + INTERVAL '${TTL_HOURS} hours', 0, NOW(), NOW())
       RETURNING ${PUBLIC_COLUMNS}`,
      { replacements: { userId: String(userId), episodeId: episode, tokenHash: hashToken(token) } });
    return { session: row, token };
  });
}

const liveOwned = 'id = :id AND user_id = :userId AND deleted_at IS NULL';

/**
 * The commands after `after` for the owner's session: { seq, commands: [{ seq, command, at }],
 * expires_at, ended }. ended: true when it has expired or was ended (or is not
 * hers: another user's session reads as ended, never as its data).
 */
async function commandsAfter(sequelize, { id, userId, after = 0 }) {
  if (!UUID_RE.test(String(id || ''))) return { seq: 0, commands: [], expires_at: null, ended: true };
  const since = Number.isInteger(Number(after)) ? Number(after) : 0;
  return guarded('poll', async () => {
    const [[row]] = await sequelize.query(
      `SELECT command_seq, last_command, expires_at, (expires_at <= NOW()) AS expired FROM ${TABLE}
        WHERE ${liveOwned} LIMIT 1`,
      { replacements: { id, userId: String(userId) } });
    if (!row || row.expired) return { seq: row ? Number(row.command_seq) : 0, commands: [], expires_at: row?.expires_at || null, ended: true };
    const recent = Array.isArray(row.last_command?.recent) ? row.last_command.recent : [];
    const commands = recent
      .filter((c) => Number(c.seq) > since && COMMANDS.includes(c.command))
      .map((c) => ({ seq: Number(c.seq), command: c.command, at: c.at || null }))
      .sort((a, b) => a.seq - b.seq);
    return { seq: Number(row.command_seq), commands, expires_at: row.expires_at, ended: false };
  });
}

/**
 * Keeps the desktop's state on the owner's live session, and keeps the
 * session open: expires_at moves to TTL_HOURS from now (never earlier than
 * it was), at most MAX_HOURS after it was opened. Null when there is none.
 */
async function putState(sequelize, { id, userId, state }) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const clean = readState(state);
  return guarded('state', async () => {
    const [rows] = await sequelize.query(
      `UPDATE ${TABLE} SET state = CAST(:state AS JSONB) || jsonb_build_object('saved_at', NOW()), updated_at = NOW(),
          expires_at = GREATEST(expires_at, LEAST(NOW() + INTERVAL '${TTL_HOURS} hours', created_at + INTERVAL '${MAX_HOURS} hours'))
        WHERE ${liveOwned} AND expires_at > NOW()
        RETURNING ${PUBLIC_COLUMNS}`,
      { replacements: { id, userId: String(userId), state: JSON.stringify(clean) } });
    return (rows || [])[0] || null;
  });
}

/** Ends (soft-deletes) the owner's session. True when one was ended. */
async function endSession(sequelize, { id, userId }) {
  if (!UUID_RE.test(String(id || ''))) return false;
  return guarded('end', async () => {
    const [rows] = await sequelize.query(
      `UPDATE ${TABLE} SET deleted_at = NOW(), updated_at = NOW() WHERE ${liveOwned} RETURNING id`,
      { replacements: { id, userId: String(userId) } });
    return (rows || []).length > 0;
  });
}

// A live session by token: the hash matches, not ended, not expired.
const liveByToken = 'token_hash = :tokenHash AND deleted_at IS NULL AND expires_at > NOW()';

/**
 * The phone's command: command_seq goes up by one and the command joins
 * last_command.recent (the newest RECENT kept), in one UPDATE, so two
 * presses at once each get their own seq. Returns { seq, state, expires_at };
 * a token with no live session is a 410.
 */
async function addCommand(sequelize, { token, command }) {
  const tokenHash = hashToken(readToken(token));
  const cmd = readCommand(command);
  return guarded('command', async () => {
    const [rows] = await sequelize.query(
      `UPDATE ${TABLE} SET
          command_seq = command_seq + 1,
          last_command = jsonb_build_object(
            'seq', command_seq + 1, 'command', CAST(:command AS TEXT), 'at', NOW(),
            'recent', (
              SELECT COALESCE(jsonb_agg(e ORDER BY (e->>'seq')::int), '[]'::jsonb) FROM (
                SELECT e FROM jsonb_array_elements(
                  COALESCE(last_command->'recent', '[]'::jsonb)
                  || jsonb_build_array(jsonb_build_object('seq', command_seq + 1, 'command', CAST(:command AS TEXT), 'at', NOW()))
                ) AS e ORDER BY (e->>'seq')::int DESC LIMIT ${RECENT}
              ) AS kept)),
          updated_at = NOW()
        WHERE ${liveByToken}
        RETURNING command_seq, state, expires_at`,
      { replacements: { tokenHash, command: cmd } });
    const row = (rows || [])[0];
    if (!row) throw new RemoteError(410, GONE, 'SESSION_GONE');
    return { seq: Number(row.command_seq), state: row.state || null, expires_at: row.expires_at };
  });
}

/**
 * What the phone shows: { state, expires_at, seq, state_age_ms } of the
 * token's live session, or a 410. state_age_ms: how long ago the desktop
 * sent this state, by the database's own clock (no two devices' clocks
 * compared), so a phone recording the take can place a beat marker that
 * much earlier; null for a state sent before saved_at was kept.
 */
async function stateByToken(sequelize, { token }) {
  const tokenHash = hashToken(readToken(token));
  return guarded('phone state', async () => {
    const [[row]] = await sequelize.query(
      `SELECT state, expires_at, command_seq,
              GREATEST(0, EXTRACT(EPOCH FROM (NOW() - (state->>'saved_at')::timestamptz)) * 1000) AS state_age_ms
         FROM ${TABLE} WHERE ${liveByToken} LIMIT 1`,
      { replacements: { tokenHash } });
    if (!row) throw new RemoteError(410, GONE, 'SESSION_GONE');
    const age = row.state_age_ms == null ? null : Math.round(Number(row.state_age_ms));
    return { state: row.state || null, expires_at: row.expires_at, seq: Number(row.command_seq), state_age_ms: Number.isFinite(age) ? age : null };
  });
}

module.exports = {
  TABLE, TTL_HOURS, MAX_HOURS, RECENT, COMMANDS, NOT_READY, GONE,
  RemoteError, missingTable, hashToken, newToken, readToken, readCommand, readState,
  createSession, commandsAfter, putState, endSession, addCommand, stateByToken,
};
