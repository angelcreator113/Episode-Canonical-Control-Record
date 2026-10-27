'use strict';

/**
 * Voice Studio B1 (Evoni, 2026-10-27; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 5): the
 * service under the line-based dialogue takes. Raw SQL, like
 * scriptVoiceClipsService and rawClipsService. Server-side only in B1: no
 * page uses it yet, and nothing here reads or writes the script
 * (episodes.script_content is read, never written; scriptSave is untouched)
 * or the legacy script_voice_clips (read only, by the legacy import).
 *
 * The rules it keeps:
 * - Sources are immutable: a file is probed (ffprobe) and hashed on the
 *   server, stored once at a content address and never edited.
 * - A new take, re-trim or re-gain adds a row; nothing replaces another take.
 * - A take is tied to a line only against the current saved script (its
 *   revision), checked by utils/voiceLineContext from the saved text, never
 *   from the page's words. Prime's lines take no voice take.
 * - An approval names one candidate revision and one association, and is
 *   current only while (1) in force, (2) for the take's latest revision,
 *   (3) the script is as it was approved or re-confirmed, and (4) the line
 *   still resolves bound with the approved or re-confirmed context (design
 *   E1, R4.1). Only a current approval may be played or exported
 *   (playableApprovals); every other state is shown, never used.
 * - Nothing approves or re-confirms by itself. A write that finds the take
 *   changed or the line gone (words, speaker, note, beat) records the
 *   approval invalid; it is never current again. A line that only moved, or
 *   that has identical twins, or whose neighbours changed, is not
 *   invalidated: it waits for a person (Evoni, 2026-10-27).
 * - Approvals are history: superseded, invalidated and revoked rows stay.
 *
 * Condition (3) is held by two pins taken when an approval or a
 * re-confirmation is written: the script revision and the id of the
 * episode's newest kept script version (scriptVersions.newestVersionId).
 * The revision alone is a hash of the text, so a script put back to the
 * approved words (A -> B -> A) has the approved revision again; each save
 * that changes the text keeps a new version, so the newest id has moved on.
 * Episode edits that are not the script (title, air date, coins) change
 * neither pin (Evoni, 2026-10-27). While an approval is in force the version
 * it names is kept (referencedScriptVersionIds, a reference provider).
 *
 * Locks, always in this order: the episode row FOR SHARE (scriptSave holds
 * FOR UPDATE), the take FOR UPDATE, the line (an advisory lock per beat and
 * index, in index order), then approval rows.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { scriptRevision, isRevision } = require('../utils/scriptRevision');
const lc = require('../utils/voiceLineContext');

const MAX_SECONDS = Number(process.env.VOICE_SOURCE_MAX_SECONDS) || 600;
const AUDIO_EXTS = ['.webm', '.ogg', '.oga', '.opus', '.m4a', '.mp4', '.mp3', '.wav', '.aac'];
const SOURCE_KINDS = ['uploaded', 'recorded'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATE_REASONS = Object.freeze({
  ...lc.REASONS,
  take_changed: 'The take was re-trimmed or re-gained after it was approved. Approve the new version.',
  take_reassigned: 'The take was tied to another line after it was approved.',
  take_removed: 'The take was removed.',
  script_saved: 'The script was saved since this take was approved or re-confirmed. Check it still fits.',
  revoked: 'The approval was withdrawn.',
});

// What an approval can be now. Only 'current' plays or exports.
const STATES = Object.freeze(['current', 'needs_review', 'moved', 'ambiguous', 'unbound', 'outdated_take', 'invalid', 'revoked', 'superseded']);
const isPlayable = (state) => state === 'current';
const IN_FORCE = 'superseded_at IS NULL AND invalidated_at IS NULL AND revoked_at IS NULL AND deleted_at IS NULL';
const IN_FORCE_A = IN_FORCE.replace(/(\w+_at) IS/g, 'a.$1 IS');

class VoiceStudioError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const fail = (status, code, message, extra) => { throw new VoiceStudioError(status, code, message, extra); };
const checkId = (id, what) => { if (!UUID_RE.test(String(id || ''))) fail(404, 'NOT_FOUND', `${what} not found`); };

// ── Media (ffprobe, sha256, S3), replaceable in tests ─────────────────────────

function defaultMedia() {
  const media = require('./rawClipMedia');
  const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
  return {
    async probe(localPath) {
      const { stdout } = await media.run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', localPath], { timeoutMs: 60 * 1000 });
      return readAudioProbe(stdout.toString());
    },
    sha256File: (localPath) => new Promise((resolve, reject) => {
      const h = crypto.createHash('sha256');
      fs.createReadStream(localPath).on('error', reject).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex')));
    }),
    upload: (localPath, key, contentType) => media.uploadFile(localPath, key, contentType),
    download: (key, localPath) => media.downloadFile(key, localPath),
    tmpPath: (name) => media.tmpPath(name),
    removeFile: (p) => media.removeFile(p),
  };
}
let mediaImpl = null;
const media = () => (mediaImpl ||= defaultMedia());
/** For tests: replace the media functions (probe, sha256File, upload, download, tmpPath, removeFile). */
function setMedia(m) { mediaImpl = m; }

/** { hasAudio, duration_ms, sample_rate, channels } from ffprobe's JSON. */
function readAudioProbe(json) {
  let data = json;
  if (typeof json === 'string') {
    try { data = JSON.parse(json); } catch (err) {
      console.error('[voiceStudio] ffprobe output is not JSON:', err.message);
      return { hasAudio: false, duration_ms: null, sample_rate: null, channels: null };
    }
  }
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  const audio = streams.find((s) => s.codec_type === 'audio');
  const seconds = Number(data?.format?.duration ?? audio?.duration);
  return {
    hasAudio: Boolean(audio),
    duration_ms: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null,
    sample_rate: audio && Number(audio.sample_rate) > 0 ? Number(audio.sample_rate) : null,
    channels: audio && Number(audio.channels) > 0 ? Number(audio.channels) : null,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

const q = (sequelize, sql, replacements, t) => sequelize.query(sql, { replacements, transaction: t });
const rows = async (sequelize, sql, replacements, t) => (await q(sequelize, sql, replacements, t))[0];
const one = async (sequelize, sql, replacements, t) => (await rows(sequelize, sql, replacements, t))[0] || null;

/**
 * The episode's saved script as the service reads it: { script, revision,
 * version_id } (version_id: the newest kept version, or null). lock:
 * 'share' (a voice write checks the script against a save in flight;
 * scriptSave holds FOR UPDATE) or none.
 */
async function episodeState(sequelize, episodeId, t, { lock = null } = {}) {
  checkId(episodeId, 'Episode');
  const row = await one(sequelize, `SELECT id, script_content, script_line_keys, deleted_at
    FROM episodes WHERE id = :episodeId${lock === 'share' ? ' FOR SHARE' : ''}`, { episodeId }, t);
  if (!row || row.deleted_at) fail(404, 'NOT_FOUND', 'Episode not found');
  const script = typeof row.script_content === 'string' ? row.script_content : '';
  const { newestVersionId } = require('./scriptVersions');
  return { script, revision: scriptRevision(script, row.script_line_keys ?? null), version_id: await newestVersionId(sequelize, episodeId, t) };
}

function requireCurrent(state, sent) {
  if (!isRevision(sent)) fail(409, 'SCRIPT_REVISION_REQUIRED', 'This page is out of date. Reload the script, then try again.', { current_revision: state.revision });
  if (sent !== state.revision) fail(409, 'SCRIPT_CHANGED', 'The script changed since this page read it. Nothing was saved.', { current_revision: state.revision });
}

async function candidateRow(sequelize, episodeId, candidateId, t, { lock = false } = {}) {
  checkId(candidateId, 'Take');
  const c = await one(sequelize, `SELECT c.*, s.duration_ms AS source_duration_ms, s.deleted_at AS source_deleted_at
    FROM line_voice_candidates c JOIN voice_source_assets s ON s.id = c.source_asset_id
    WHERE c.id = :candidateId${lock ? ' FOR UPDATE OF c' : ''}`, { candidateId }, t);
  if (!c || c.deleted_at || c.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Take not found');
  return c;
}

const latestRevision = (sequelize, candidateId, t) => one(sequelize,
  'SELECT * FROM line_voice_candidate_revisions WHERE candidate_id = :candidateId AND deleted_at IS NULL ORDER BY revision_no DESC LIMIT 1',
  { candidateId }, t);

const currentAssociation = (sequelize, candidateId, t) => one(sequelize,
  'SELECT * FROM line_voice_associations WHERE candidate_id = :candidateId AND superseded_at IS NULL AND deleted_at IS NULL',
  { candidateId }, t);

const settingsHash = (r) => crypto.createHash('sha256')
  .update(JSON.stringify([r.in_ms, r.out_ms, Number(r.gain_db), r.fade_in_ms, r.fade_out_ms, Boolean(r.normalise)])).digest('hex');

// ── Sources ──────────────────────────────────────────────────────────────────

/**
 * An uploaded or recorded file as a source: checked, probed and hashed here,
 * then stored once at episodes/<id>/voice/sources/<sha256><ext>. The same
 * file twice for one episode is the same source (returned, not stored again).
 * file: { path, originalname, mimetype, size }.
 */
async function createSource(sequelize, { episodeId, kind, file, userId = null }) {
  if (!SOURCE_KINDS.includes(kind)) fail(400, 'BAD_KIND', 'A source is "uploaded" or "recorded"');
  if (!file || !file.path) fail(400, 'NO_FILE', 'No audio was sent (field "audio")');
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!AUDIO_EXTS.includes(ext)) fail(400, 'BAD_TYPE', `Only these audio files can be used: ${AUDIO_EXTS.join(' ')}`);
  await episodeState(sequelize, episodeId);

  let probe;
  try {
    probe = await media().probe(file.path);
  } catch (err) {
    console.error('[voiceStudio] ffprobe could not read the upload:', err.message);
    fail(400, 'UNREADABLE', 'That file is not audio we can read');
  }
  if (!probe.hasAudio) fail(400, 'NO_AUDIO', 'That file has no audio in it');
  if (!probe.duration_ms) fail(400, 'NO_DURATION', 'That file has no length we can read');
  if (probe.duration_ms > MAX_SECONDS * 1000) fail(400, 'TOO_LONG', `A take can be at most ${MAX_SECONDS / 60} minutes`);
  const sha = await media().sha256File(file.path);
  const { size } = await fs.promises.stat(file.path);
  const key = `episodes/${episodeId}/voice/sources/${sha}${ext}`;

  const existing = await one(sequelize, 'SELECT * FROM voice_source_assets WHERE s3_key = :key', { key });
  if (existing) return { source: existing, existed: true };

  await media().upload(file.path, key, file.mimetype || 'application/octet-stream');
  try {
    const [created] = await rows(sequelize, `INSERT INTO voice_source_assets
      (episode_id, source_kind, s3_key, sha256, content_type, file_size_bytes, duration_ms, sample_rate, channels, original_filename, created_by)
      VALUES (:episodeId, :kind, :key, :sha, :type, :size, :duration, :rate, :channels, :name, :userId) RETURNING *`, {
      episodeId, kind, key, sha, type: file.mimetype || 'application/octet-stream', size, duration: probe.duration_ms,
      rate: probe.sample_rate, channels: probe.channels, name: file.originalname || null, userId,
    });
    return { source: created, existed: false };
  } catch (err) {
    // The file is in S3 and no row names it; it is left there (sources are never deleted), and logged.
    console.error(`[voiceStudio] source row not written; ${key} is in S3 without a row:`, err.message);
    throw err;
  }
}

// ── Candidates and their revisions ───────────────────────────────────────────

function readSettings(body, durationMs, base = null) {
  const num = (v, d) => (v === undefined || v === null || v === '' ? d : Number(v));
  const r = {
    in_ms: num(body.in_ms, base ? base.in_ms : 0),
    out_ms: num(body.out_ms, base ? base.out_ms : durationMs),
    gain_db: num(body.gain_db, base ? Number(base.gain_db) : 0),
    fade_in_ms: num(body.fade_in_ms, base ? base.fade_in_ms : 0),
    fade_out_ms: num(body.fade_out_ms, base ? base.fade_out_ms : 0),
    normalise: body.normalise === undefined ? Boolean(base && base.normalise) : body.normalise === true || body.normalise === 'true',
  };
  const ints = ['in_ms', 'out_ms', 'fade_in_ms', 'fade_out_ms'];
  if (ints.some((k) => !Number.isInteger(r[k]))) fail(400, 'BAD_RANGE', 'Times are whole milliseconds');
  if (!(r.in_ms >= 0 && r.in_ms < r.out_ms && r.out_ms <= durationMs)) fail(400, 'BAD_RANGE', `In and out must be within the take (0–${durationMs} ms), with in before out`);
  if (!(Number.isFinite(r.gain_db) && r.gain_db >= -24 && r.gain_db <= 12) || Math.abs(Math.round(r.gain_db * 10) - r.gain_db * 10) > 1e-9) fail(400, 'BAD_GAIN', 'Gain is −24 to +12 dB, in tenths');
  if (!(r.fade_in_ms >= 0 && r.fade_in_ms <= 2000 && r.fade_out_ms >= 0 && r.fade_out_ms <= 2000)) fail(400, 'BAD_FADE', 'Fades are 0 to 2000 ms');
  if (r.fade_in_ms + r.fade_out_ms > r.out_ms - r.in_ms) fail(400, 'BAD_FADE', 'The fades are longer than the take');
  return r;
}

async function insertRevision(sequelize, candidateId, revisionNo, s, userId, t) {
  const [row] = await rows(sequelize, `INSERT INTO line_voice_candidate_revisions
    (candidate_id, revision_no, in_ms, out_ms, gain_db, fade_in_ms, fade_out_ms, normalise, settings_hash, created_by)
    VALUES (:candidateId, :revisionNo, :in_ms, :out_ms, :gain_db, :fade_in_ms, :fade_out_ms, :normalise, :hash, :userId) RETURNING *`,
  { candidateId, revisionNo, ...s, hash: settingsHash(s), userId }, t);
  return row;
}

/** A new take for a source: the candidate and its first revision (the whole source unless in/out are given). */
async function createCandidate(sequelize, { episodeId, sourceAssetId, label = null, settings = {}, userId = null }) {
  checkId(sourceAssetId, 'Source');
  return sequelize.transaction(async (t) => {
    await episodeState(sequelize, episodeId, t);
    const source = await one(sequelize, 'SELECT * FROM voice_source_assets WHERE id = :sourceAssetId FOR SHARE', { sourceAssetId }, t);
    if (!source || source.deleted_at || source.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Source not found');
    const s = readSettings(settings, source.duration_ms);
    const [candidate] = await rows(sequelize, `INSERT INTO line_voice_candidates (episode_id, source_asset_id, label, created_by)
      VALUES (:episodeId, :sourceAssetId, :label, :userId) RETURNING *`, { episodeId, sourceAssetId, label, userId }, t);
    const revision = await insertRevision(sequelize, candidate.id, 1, s, userId, t);
    return { candidate, revision };
  });
}

/** A new revision of a take's trim, gain, fades and normalise. Earlier revisions stay. */
async function reviseCandidate(sequelize, { episodeId, candidateId, settings = {}, userId = null }) {
  return sequelize.transaction(async (t) => {
    await episodeState(sequelize, episodeId, t);
    const c = await candidateRow(sequelize, episodeId, candidateId, t, { lock: true });
    const latest = await latestRevision(sequelize, candidateId, t);
    const s = readSettings(settings, c.source_duration_ms, latest);
    return { revision: await insertRevision(sequelize, candidateId, (latest ? latest.revision_no : 0) + 1, s, userId, t) };
  });
}

// ── Associations ─────────────────────────────────────────────────────────────

/**
 * Ties a take to the line at (beat, index) of the saved script at `scriptRevision`
 * (the current one, or 409). Re-derived from the saved text; Prime's lines
 * and beats outside 1-14 are refused. The take's earlier association is
 * superseded (kept). Confirming a move is this, at the suggested index.
 */
async function associate(sequelize, { episodeId, candidateId, scriptRevision: sent, beatNumber, lineIndex, userId = null }) {
  const beat = Number(beatNumber);
  const index = Number(lineIndex);
  if (!Number.isInteger(beat) || beat < 1 || beat > 14) fail(400, 'BAD_BEAT', 'Takes are tied to lines in beats 1 to 14');
  if (!Number.isInteger(index) || index < 0) fail(400, 'BAD_LINE', 'No such line');
  return sequelize.transaction(async (t) => {
    const state = await episodeState(sequelize, episodeId, t, { lock: 'share' });
    requireCurrent(state, sent);
    await candidateRow(sequelize, episodeId, candidateId, t, { lock: true });
    const { ctx, reason } = lc.lineAt(lc.lineContexts(state.script), beat, index);
    if (!ctx) fail(409, reason === 'duplicate_beat' ? 'DUPLICATE_BEAT' : 'NO_SUCH_LINE', lc.REASONS[reason] || 'No such line', { reason });
    if (ctx.prime) fail(409, 'PRIME_LINE', "Prime's lines use her own take, not a voice take");
    if (!ctx.speaker_key) fail(409, 'NOT_DIALOGUE', 'Only spoken lines take a voice take');
    const previous = await currentAssociation(sequelize, candidateId, t);
    if (previous) await q(sequelize, 'UPDATE line_voice_associations SET superseded_at = NOW(), updated_at = NOW() WHERE id = :id', { id: previous.id }, t);
    const a = lc.associationOf(ctx);
    const [row] = await rows(sequelize, `INSERT INTO line_voice_associations
      (candidate_id, episode_id, beat_number, line_index, occurrence, speaker_key, speaker_written, delivery_note, words,
       row_hash, prev_hash, next_hash, context_hash, script_revision, created_by)
      VALUES (:candidateId, :episodeId, :beat_number, :line_index, :occurrence, :speaker_key, :speaker_written, :delivery_note, :words,
       :row_hash, :prev_hash, :next_hash, :context_hash, :rev, :userId) RETURNING *`,
    { candidateId, episodeId, ...a, rev: state.revision, userId }, t);
    if (previous) {
      await q(sequelize, 'UPDATE line_voice_associations SET superseded_by = :to WHERE id = :id', { id: previous.id, to: row.id }, t);
      // The take's approval was for the line it was tied to before: it is not valid for this one, ever.
      const approvals = await rows(sequelize, `SELECT id FROM line_voice_approvals WHERE candidate_id = :candidateId AND ${IN_FORCE}`, { candidateId }, t);
      for (const a of approvals) await invalidate(sequelize, a.id, 'take_reassigned', t);
    }
    return { association: row };
  });
}

// ── Approval state (design E1) ───────────────────────────────────────────────

const pinsMatch = (pin, state) => Boolean(pin)
  && pin.pinned_script_revision === state.revision
  && (pin.pinned_script_version_id ?? null) === state.version_id;

/**
 * An approval's state now: { state, reason, resolution }. `contexts` is
 * lineContexts of the current script; `state` the episode state. States
 * (STATES): current | needs_review (bound, but the script was saved or the
 * neighbours changed since it was approved or re-confirmed) | moved |
 * ambiguous | unbound (the line is gone; recorded invalid when a write sees
 * it) | outdated_take | invalid (recorded) | revoked | superseded.
 */
async function evaluate(sequelize, approval, contexts, state, t) {
  if (approval.revoked_at) return { state: 'revoked', reason: 'revoked' };
  if (approval.invalidated_at) return { state: 'invalid', reason: approval.invalidated_reason };
  if (approval.superseded_at) return { state: 'superseded', reason: null };
  const candidate = await one(sequelize, 'SELECT deleted_at FROM line_voice_candidates WHERE id = :id', { id: approval.candidate_id }, t);
  if (!candidate || candidate.deleted_at) return { state: 'invalid', reason: 'take_removed' };
  const latest = await latestRevision(sequelize, approval.candidate_id, t);
  if (!latest || latest.id !== approval.candidate_revision_id) return { state: 'outdated_take', reason: 'take_changed' };
  const assoc = await currentAssociation(sequelize, approval.candidate_id, t);
  if (!assoc || assoc.id !== approval.association_id) return { state: 'invalid', reason: 'take_reassigned' };
  const resolution = lc.resolve(approval.approved_context, contexts);
  if (resolution.status === 'unbound') return { state: 'unbound', reason: resolution.reason, resolution };
  if (resolution.status !== 'bound') return { state: resolution.status, reason: resolution.reason, resolution };
  const now = resolution.ctx.context_hash;
  if (pinsMatch(approval, state) && now === approval.approved_context_hash) return { state: 'current', reason: null, resolution };
  const confirmation = await one(sequelize, `SELECT pinned_script_revision, pinned_script_version_id, context_hash
    FROM line_voice_reconfirmations WHERE approval_id = :id AND deleted_at IS NULL
    ORDER BY confirmed_at DESC, created_at DESC, id DESC LIMIT 1`, { id: approval.id }, t);
  if (pinsMatch(confirmation, state) && now === confirmation.context_hash) return { state: 'current', reason: null, resolution };
  return { state: 'needs_review', reason: resolution.reason === 'neighbours_changed' ? 'neighbours_changed' : 'script_saved', resolution };
}

// Every column the state needs.
const APPROVAL_COLUMNS = `a.id, a.episode_id, a.candidate_id, a.candidate_revision_id, a.association_id, a.beat_number, a.line_index,
  a.occurrence, a.approved_context, a.approved_context_hash, a.pinned_script_revision,
  a.pinned_script_version_id, a.approved_by, a.approved_at, a.superseded_at, a.superseded_by,
  a.invalidated_at, a.invalidated_reason, a.revoked_at, a.revoked_by, a.deleted_at`;

async function invalidate(sequelize, approvalId, reason, t) {
  await q(sequelize, `UPDATE line_voice_approvals SET invalidated_at = NOW(), invalidated_reason = :reason, updated_at = NOW()
    WHERE id = :approvalId AND invalidated_at IS NULL`, { approvalId, reason: String(reason || 'line_removed').slice(0, 40) }, t);
}

/** Records invalid what a write found can never be current again: the take changed, or the line is gone. */
async function recordIfBroken(sequelize, approvalId, e, t) {
  if (e.state === 'unbound') await invalidate(sequelize, approvalId, e.reason, t);
  else if (e.state === 'outdated_take') await invalidate(sequelize, approvalId, 'take_changed', t);
  else return false;
  return true;
}

/** Serialises writes to the episode's lines (beat, index), in index order so two writers never wait on each other. */
async function lockLines(sequelize, episodeId, beatNumber, indexes, t) {
  for (const index of [...new Set(indexes)].sort((x, y) => x - y)) {
    await q(sequelize, 'SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', { key: `voice-line:${episodeId}:${beatNumber}:${index}` }, t);
  }
}

/** The approval in force at (beat, index), locked, or null. */
const inForceAt = (sequelize, episodeId, beatNumber, lineIndex, t) => one(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a
  WHERE a.episode_id = :episodeId AND a.beat_number = :beatNumber AND a.line_index = :lineIndex AND ${IN_FORCE_A}
  FOR UPDATE`, { episodeId, beatNumber, lineIndex }, t);

/** The expected-approval token a write sends: the id of the approval it saw in force at the line, or null for none. */
function readExpected(value) {
  if (value === undefined) fail(400, 'EXPECTED_APPROVAL_REQUIRED', 'Say which approval this line had when the page read it (expected_approval_id, or null for none)');
  if (value === null || value === '') return null;
  if (!UUID_RE.test(String(value))) fail(400, 'BAD_EXPECTED_APPROVAL', 'expected_approval_id is not an approval id');
  return String(value);
}

function checkExpected(found, expected) {
  const current = found ? found.id : null;
  if (current !== expected) {
    fail(409, 'APPROVAL_CHANGED', 'The approval for this line changed since the page read it. Nothing was saved. Reload and try again.', { current_approval_id: current });
  }
}

async function insertApproval(sequelize, { episodeId, candidateId, revisionId, assocId, ctx, state, userId }, t) {
  const [row] = await rows(sequelize, `INSERT INTO line_voice_approvals
    (episode_id, candidate_id, candidate_revision_id, association_id, beat_number, line_index, occurrence,
     approved_context, approved_context_hash, pinned_script_revision, pinned_script_version_id, approved_by)
    VALUES (:episodeId, :candidateId, :revisionId, :assocId, :beat, :index, :occurrence,
     CAST(:context AS jsonb), :contextHash, :rev, :versionId, :userId) RETURNING id`, {
    episodeId, candidateId, revisionId, assocId, beat: ctx.beat_number, index: ctx.line_index, occurrence: ctx.occurrence,
    context: JSON.stringify(lc.associationOf(ctx)), contextHash: ctx.context_hash, rev: state.revision, versionId: state.version_id, userId,
  }, t);
  return row;
}

async function supersede(sequelize, ids, byId, t) {
  if (!ids.length) return;
  await q(sequelize, 'UPDATE line_voice_approvals SET superseded_at = NOW(), superseded_by = :byId, updated_at = NOW() WHERE id IN (:ids)', { ids, byId }, t);
}

// Approvals no longer in force but not yet superseded at a line (invalid or revoked): the new approval
// supersedes them too, so the line lists once while they stay in its history.
const settledAt = (sequelize, episodeId, beatNumber, lineIndex, t) => rows(sequelize, `SELECT id FROM line_voice_approvals
  WHERE episode_id = :episodeId AND beat_number = :beatNumber AND line_index = :lineIndex AND superseded_at IS NULL AND deleted_at IS NULL
    AND (invalidated_at IS NOT NULL OR revoked_at IS NOT NULL) FOR UPDATE`, { episodeId, beatNumber, lineIndex }, t);

const mapRace = (err) => {
  if ((err?.original?.code || err?.parent?.code) === '23505') {
    console.error('[voiceStudio] two approvals for one line or take at once:', err.message);
    fail(409, 'APPROVAL_CHANGED', 'Another approval for this line was saved at the same moment. Nothing was saved. Reload and try again.');
  }
  throw err;
};

/**
 * Approves a take's revision for the line it is tied to, against the current
 * saved script. The revision must be the take's latest and its association
 * current and bound now. `expectedApprovalId` is the approval the page saw
 * in force at the line (null for none); another one there now is a 409, so
 * of two approvals sent from the same view only one is saved. The one in
 * force at the line, and the take's own, are superseded (recorded invalid
 * first when broken); one that moved or is ambiguous is resolved first.
 */
async function approve(sequelize, { episodeId, candidateId, candidateRevisionId, scriptRevision: sent, expectedApprovalId, userId }) {
  if (!userId) fail(401, 'AUTH_REQUIRED', 'Sign in to approve');
  checkId(candidateRevisionId, 'Take revision');
  const expected = readExpected(expectedApprovalId);
  try {
    return await sequelize.transaction(async (t) => {
      const state = await episodeState(sequelize, episodeId, t, { lock: 'share' });
      requireCurrent(state, sent);
      await candidateRow(sequelize, episodeId, candidateId, t, { lock: true });
      const latest = await latestRevision(sequelize, candidateId, t);
      if (!latest || latest.id !== candidateRevisionId) fail(409, 'NOT_LATEST_REVISION', 'This is not the take\'s latest version. Reload and approve the current one.');
      const assoc = await currentAssociation(sequelize, candidateId, t);
      if (!assoc) fail(409, 'NOT_ASSOCIATED', 'Tie the take to its line before approving it');
      const contexts = lc.lineContexts(state.script);
      const resolution = lc.resolve(assoc, contexts);
      if (resolution.status !== 'bound') fail(409, 'NOT_BOUND', lc.REASONS[resolution.reason] || 'The line changed', { reason: resolution.reason, resolution });
      const ctx = resolution.ctx;

      await lockLines(sequelize, episodeId, ctx.beat_number, [ctx.line_index], t);
      const atLine = await inForceAt(sequelize, episodeId, ctx.beat_number, ctx.line_index, t);
      checkExpected(atLine, expected);
      const replaced = [];
      if (atLine) {
        const e = await evaluate(sequelize, atLine, contexts, state, t);
        if (e.state === 'moved' || e.state === 'ambiguous') {
          fail(409, 'LINE_HAS_UNRESOLVED_APPROVAL', 'This place holds an approval whose line moved or is ambiguous. Confirm where it belongs, or withdraw it, first.', { approval_id: atLine.id, state: e.state, resolution: e.resolution });
        }
        await recordIfBroken(sequelize, atLine.id, e, t);
        replaced.push(atLine.id);
      }
      const own = await one(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a
        WHERE a.candidate_id = :candidateId AND ${IN_FORCE_A} FOR UPDATE`, { candidateId }, t);
      if (own && own.id !== atLine?.id) {
        await recordIfBroken(sequelize, own.id, await evaluate(sequelize, own, contexts, state, t), t);
        replaced.push(own.id);
      }
      const settled = (await settledAt(sequelize, episodeId, ctx.beat_number, ctx.line_index, t)).map((r) => r.id);
      // Out of force before the insert, so the one-in-force indexes hold; then pointed at the new row.
      const toSupersede = [...new Set([...replaced, ...settled])];
      if (toSupersede.length) await q(sequelize, 'UPDATE line_voice_approvals SET superseded_at = NOW(), updated_at = NOW() WHERE id IN (:ids)', { ids: toSupersede }, t);
      const row = await insertApproval(sequelize, { episodeId, candidateId, revisionId: latest.id, assocId: assoc.id, ctx, state, userId }, t);
      await supersede(sequelize, toSupersede, row.id, t);
      return { approval_id: row.id, superseded: replaced };
    });
  } catch (err) {
    return mapRace(err);
  }
}

/**
 * A person's answer for an approval whose line moved or is ambiguous: the
 * take is for the line now at `lineIndex` (one of the resolution's
 * candidates). The take is tied there and approved there, same revision;
 * the old approval is superseded by the new one (kept). `expectedApprovalId`
 * is the approval the page saw in force at the target line (null for none).
 */
async function resolveApproval(sequelize, { episodeId, approvalId, scriptRevision: sent, lineIndex, expectedApprovalId, userId }) {
  if (!userId) fail(401, 'AUTH_REQUIRED', 'Sign in to confirm a take');
  checkId(approvalId, 'Approval');
  const expected = readExpected(expectedApprovalId);
  const target = Number(lineIndex);
  if (!Number.isInteger(target) || target < 0) fail(400, 'BAD_LINE', 'No such line');
  try {
    return await sequelize.transaction(async (t) => {
      const state = await episodeState(sequelize, episodeId, t, { lock: 'share' });
      requireCurrent(state, sent);
      const seen = await one(sequelize, 'SELECT candidate_id, beat_number, line_index FROM line_voice_approvals WHERE id = :approvalId AND episode_id = :episodeId', { approvalId, episodeId }, t);
      if (!seen) fail(404, 'NOT_FOUND', 'Approval not found');
      await candidateRow(sequelize, episodeId, seen.candidate_id, t, { lock: true });
      await lockLines(sequelize, episodeId, seen.beat_number, [seen.line_index, target], t);
      const a = await one(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a WHERE a.id = :approvalId FOR UPDATE`, { approvalId }, t);
      const contexts = lc.lineContexts(state.script);
      const e = await evaluate(sequelize, a, contexts, state, t);
      if (e.state !== 'moved' && e.state !== 'ambiguous') {
        await recordIfBroken(sequelize, a.id, e, t);
        fail(409, 'NOT_MOVED', 'This approval is not waiting for its line to be confirmed.', { state: e.state, reason: e.reason });
      }
      if (!e.resolution.candidates.includes(target)) fail(409, 'NOT_A_CANDIDATE', 'That line is not one this take could be for.', { candidates: e.resolution.candidates });
      const { ctx } = lc.lineAt(contexts, a.beat_number, target);

      const atTarget = await inForceAt(sequelize, episodeId, a.beat_number, target, t);
      const other = atTarget && atTarget.id !== a.id ? atTarget : null;
      checkExpected(other, expected);
      const replaced = [a.id];
      if (other) {
        const e2 = await evaluate(sequelize, other, contexts, state, t);
        if (!(await recordIfBroken(sequelize, other.id, e2, t))) {
          fail(409, 'LINE_ALREADY_APPROVED', 'That line already has an approved take. Withdraw it first.', { approval_id: other.id, state: e2.state });
        }
        replaced.push(other.id);
      }
      const settled = (await settledAt(sequelize, episodeId, a.beat_number, target, t)).map((r) => r.id);
      const toSupersede = [...new Set([...replaced, ...settled])];
      await q(sequelize, 'UPDATE line_voice_approvals SET superseded_at = NOW(), updated_at = NOW() WHERE id IN (:ids)', { ids: toSupersede }, t);

      // The take tied to the confirmed line: a new association row, the old one superseded (kept).
      const previous = await currentAssociation(sequelize, a.candidate_id, t);
      await q(sequelize, 'UPDATE line_voice_associations SET superseded_at = NOW(), updated_at = NOW() WHERE id = :id', { id: previous.id }, t);
      const [assoc] = await rows(sequelize, `INSERT INTO line_voice_associations
        (candidate_id, episode_id, beat_number, line_index, occurrence, speaker_key, speaker_written, delivery_note, words,
         row_hash, prev_hash, next_hash, context_hash, script_revision, created_by)
        VALUES (:candidateId, :episodeId, :beat_number, :line_index, :occurrence, :speaker_key, :speaker_written, :delivery_note, :words,
         :row_hash, :prev_hash, :next_hash, :context_hash, :rev, :userId) RETURNING id`,
      { candidateId: a.candidate_id, episodeId, ...lc.associationOf(ctx), rev: state.revision, userId }, t);
      await q(sequelize, 'UPDATE line_voice_associations SET superseded_by = :to WHERE id = :id', { id: previous.id, to: assoc.id }, t);

      const row = await insertApproval(sequelize, { episodeId, candidateId: a.candidate_id, revisionId: a.candidate_revision_id, assocId: assoc.id, ctx, state, userId }, t);
      await supersede(sequelize, toSupersede, row.id, t);
      return { approval_id: row.id, superseded: replaced };
    });
  } catch (err) {
    return mapRace(err);
  }
}

/** Withdraws an approval in force (kept, marked revoked). A second withdrawal, or one of a replaced approval, is a 409. */
async function revokeApproval(sequelize, { episodeId, approvalId, userId }) {
  if (!userId) fail(401, 'AUTH_REQUIRED', 'Sign in to withdraw an approval');
  checkId(approvalId, 'Approval');
  return sequelize.transaction(async (t) => {
    await episodeState(sequelize, episodeId, t);
    const a = await one(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a WHERE a.id = :approvalId AND a.episode_id = :episodeId FOR UPDATE`, { approvalId, episodeId }, t);
    if (!a || a.deleted_at) fail(404, 'NOT_FOUND', 'Approval not found');
    if (a.superseded_at || a.invalidated_at || a.revoked_at) fail(409, 'APPROVAL_CHANGED', 'This approval is no longer in force. Reload.', { state: a.revoked_at ? 'revoked' : a.invalidated_at ? 'invalid' : 'superseded' });
    await q(sequelize, 'UPDATE line_voice_approvals SET revoked_at = NOW(), revoked_by = :userId, updated_at = NOW() WHERE id = :approvalId', { approvalId, userId: String(userId).slice(0, 255) }, t);
    return { revoked: approvalId };
  });
}

/** One approval as the summary lists it. */
function listed(a, e) {
  const ctx = e.resolution?.ctx || null;
  return {
    approval_id: a.id, candidate_id: a.candidate_id, candidate_revision_id: a.candidate_revision_id,
    beat_number: a.beat_number, line_index: a.line_index, occurrence: a.occurrence,
    words: a.approved_context?.words || null, speaker: a.approved_context?.speaker_written || null,
    approved_context_hash: a.approved_context_hash,
    // What a person reviews and re-confirms: the line's context now (bound only).
    context_hash: e.resolution?.status === 'bound' && ctx ? ctx.context_hash : null,
    state: e.state, playable: isPlayable(e.state), reason: e.reason, reason_text: e.reason ? STATE_REASONS[e.reason] || e.reason : null,
    resolution: e.resolution ? { status: e.resolution.status, line_index: e.resolution.line_index, candidates: e.resolution.candidates, hint_beat: e.resolution.hint_beat } : null,
    approved_by: a.approved_by, approved_at: a.approved_at, revoked_by: a.revoked_by, revoked_at: a.revoked_at,
  };
}

/** Every approval not superseded, with its state now, and counts by episode and beat. */
async function summary(sequelize, { episodeId }) {
  return sequelize.transaction(async (t) => {
    const state = await episodeState(sequelize, episodeId, t);
    const contexts = lc.lineContexts(state.script);
    const approvals = await rows(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a
      WHERE a.episode_id = :episodeId AND a.superseded_at IS NULL AND a.deleted_at IS NULL ORDER BY a.beat_number, a.line_index, a.approved_at`, { episodeId }, t);
    const items = [];
    for (const a of approvals) items.push(listed(a, await evaluate(sequelize, a, contexts, state, t)));
    const unassigned = await one(sequelize, `SELECT count(*)::int AS n FROM line_voice_candidates c
      WHERE c.episode_id = :episodeId AND c.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM line_voice_associations s WHERE s.candidate_id = c.id AND s.superseded_at IS NULL AND s.deleted_at IS NULL)`, { episodeId }, t);
    const count = (list) => list.reduce((acc, i) => ({ ...acc, [i.state]: (acc[i.state] || 0) + 1 }), {});
    const beats = {};
    for (const i of items) (beats[i.beat_number] ||= []).push(i);
    return {
      script_revision: state.revision,
      counts: count(items),
      beats: Object.fromEntries(Object.entries(beats).map(([b, list]) => [b, count(list)])),
      takes_unassigned: unassigned.n,
      approvals: items,
    };
  });
}

/**
 * The takes that may be played or exported now: current approvals only,
 * with the revision's settings and the source. Every later reader (the
 * teleprompter's Voice Studio playback, an export) reads this and nothing
 * looser; an approval that moved, is ambiguous, needs review or is not in
 * force is never in it.
 */
async function playableApprovals(sequelize, { episodeId }) {
  const sum = await summary(sequelize, { episodeId });
  const ids = sum.approvals.filter((a) => a.playable).map((a) => a.approval_id);
  if (!ids.length) return { script_revision: sum.script_revision, takes: [] };
  const takes = await rows(sequelize, `SELECT a.id AS approval_id, a.beat_number, a.line_index, a.candidate_id, r.id AS revision_id,
      r.in_ms, r.out_ms, r.gain_db, r.fade_in_ms, r.fade_out_ms, r.normalise, s.id AS source_id, s.s3_key, s.sha256, s.content_type
    FROM line_voice_approvals a
    JOIN line_voice_candidate_revisions r ON r.id = a.candidate_revision_id
    JOIN line_voice_candidates c ON c.id = a.candidate_id
    JOIN voice_source_assets s ON s.id = c.source_asset_id
    WHERE a.id IN (:ids) ORDER BY a.beat_number, a.line_index`, { ids });
  return { script_revision: sum.script_revision, takes };
}

/** Every approval the episode has had, newest first, as stored (history: superseded, invalid and revoked included). */
async function approvalHistory(sequelize, { episodeId }) {
  await episodeState(sequelize, episodeId);
  return rows(sequelize, `SELECT a.id, a.candidate_id, a.candidate_revision_id, a.beat_number, a.line_index, a.occurrence,
      a.approved_context->>'words' AS words, a.approved_by, a.approved_at, a.pinned_script_revision, a.pinned_script_version_id,
      a.superseded_at, a.superseded_by, a.invalidated_at, a.invalidated_reason, a.revoked_at, a.revoked_by
    FROM line_voice_approvals a WHERE a.episode_id = :episodeId AND a.deleted_at IS NULL
    ORDER BY a.approved_at DESC, a.created_at DESC`, { episodeId });
}

/**
 * A person's re-confirmation of approvals that still match their lines
 * (design R5.2). One transaction: the script revision must be current
 * (else 409, nothing written); each item is re-checked and confirmed only
 * when it needs review and its context hash is the line's context as the
 * page showed it now. items: [{ approval_id, context_hash }].
 */
async function reconfirm(sequelize, { episodeId, scriptRevision: sent, items, userId }) {
  if (!userId) fail(401, 'AUTH_REQUIRED', 'Sign in to re-confirm');
  if (!Array.isArray(items) || !items.length || items.length > 500) fail(400, 'NO_ITEMS', 'Choose the takes to re-confirm');
  return sequelize.transaction(async (t) => {
    const state = await episodeState(sequelize, episodeId, t, { lock: 'share' });
    requireCurrent(state, sent);
    const contexts = lc.lineContexts(state.script);
    const confirmed = [];
    const refused = [];
    for (const item of items) {
      const id = String(item?.approval_id || '');
      if (!UUID_RE.test(id)) { refused.push({ approval_id: id, reason: 'not_found' }); continue; }
      const seen = await one(sequelize, 'SELECT candidate_id FROM line_voice_approvals WHERE id = :id AND episode_id = :episodeId', { id, episodeId }, t);
      if (!seen) { refused.push({ approval_id: id, reason: 'not_found' }); continue; }
      // The take first (a re-trim cannot land between the check and the write), then the approval.
      await q(sequelize, 'SELECT id FROM line_voice_candidates WHERE id = :cid FOR UPDATE', { cid: seen.candidate_id }, t);
      const a = await one(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a WHERE a.id = :id FOR UPDATE`, { id }, t);
      if (a.deleted_at || a.superseded_at) { refused.push({ approval_id: id, reason: 'not_found' }); continue; }
      const e = await evaluate(sequelize, a, contexts, state, t);
      if (e.state === 'current') { refused.push({ approval_id: id, reason: 'already_current' }); continue; }
      if (e.state !== 'needs_review') {
        await recordIfBroken(sequelize, a.id, e, t);
        refused.push({ approval_id: id, state: e.state, reason: e.reason, reason_text: STATE_REASONS[e.reason] || e.reason });
        continue;
      }
      const now = e.resolution.ctx.context_hash;
      if (item.context_hash !== now) { refused.push({ approval_id: id, reason: 'context_mismatch' }); continue; }
      await q(sequelize, `INSERT INTO line_voice_reconfirmations (approval_id, pinned_script_revision, pinned_script_version_id, context_hash, confirmed_by)
        VALUES (:id, :rev, :versionId, :hash, :userId)`, { id, rev: state.revision, versionId: state.version_id, hash: now, userId }, t);
      confirmed.push(id);
    }
    return { script_revision: state.revision, confirmed, refused };
  });
}

/**
 * The retention reference provider (scriptVersions.REFERENCE_PROVIDERS):
 * the script versions an approval in force, or one of its
 * re-confirmations, was pinned to. Before the tables exist (the migration
 * not yet run), none.
 */
async function referencedScriptVersionIds(sequelize, episodeId, t = null) {
  const [[reg]] = await sequelize.query("SELECT to_regclass('public.line_voice_approvals') IS NOT NULL AS ok", { transaction: t });
  if (!reg.ok) return [];
  const found = await rows(sequelize, `SELECT a.pinned_script_version_id AS id FROM line_voice_approvals a
      WHERE a.episode_id = :episodeId AND ${IN_FORCE_A} AND a.pinned_script_version_id IS NOT NULL
    UNION
    SELECT r.pinned_script_version_id FROM line_voice_reconfirmations r JOIN line_voice_approvals a ON a.id = r.approval_id
      WHERE a.episode_id = :episodeId AND ${IN_FORCE_A} AND r.deleted_at IS NULL AND r.pinned_script_version_id IS NOT NULL`,
  { episodeId }, t);
  return found.map((r) => String(r.id));
}

/** Removes a take (soft delete). Its source stays; a current approval of it is recorded invalid. */
async function removeCandidate(sequelize, { episodeId, candidateId }) {
  return sequelize.transaction(async (t) => {
    await episodeState(sequelize, episodeId, t);
    await candidateRow(sequelize, episodeId, candidateId, t, { lock: true });
    await q(sequelize, 'UPDATE line_voice_candidates SET deleted_at = NOW(), updated_at = NOW() WHERE id = :candidateId', { candidateId }, t);
    const current = await rows(sequelize, `SELECT id FROM line_voice_approvals WHERE candidate_id = :candidateId AND ${IN_FORCE}`, { candidateId }, t);
    for (const a of current) await invalidate(sequelize, a.id, 'take_removed', t);
    return { removed: candidateId, approvals_invalidated: current.map((a) => a.id) };
  });
}

/** The episode's takes: candidate, source, latest revision and current association. */
async function listTakes(sequelize, { episodeId }) {
  await episodeState(sequelize, episodeId);
  return rows(sequelize, `SELECT c.id, c.label, c.created_at, c.created_by,
      s.id AS source_id, s.source_kind, s.duration_ms AS source_duration_ms, s.original_filename,
      r.id AS revision_id, r.revision_no, r.in_ms, r.out_ms, r.gain_db, r.fade_in_ms, r.fade_out_ms, r.normalise,
      a.id AS association_id, a.beat_number, a.line_index, a.speaker_written, a.words, a.script_revision AS associated_at_revision
    FROM line_voice_candidates c
    JOIN voice_source_assets s ON s.id = c.source_asset_id
    LEFT JOIN LATERAL (SELECT * FROM line_voice_candidate_revisions x WHERE x.candidate_id = c.id AND x.deleted_at IS NULL ORDER BY x.revision_no DESC LIMIT 1) r ON TRUE
    LEFT JOIN line_voice_associations a ON a.candidate_id = c.id AND a.superseded_at IS NULL AND a.deleted_at IS NULL
    WHERE c.episode_id = :episodeId AND c.deleted_at IS NULL
    ORDER BY a.beat_number NULLS LAST, a.line_index NULLS LAST, c.created_at`, { episodeId });
}

// ── Legacy import ────────────────────────────────────────────────────────────

/**
 * Brings the episode's old voice clips (script_voice_clips, live and removed)
 * in as sources with one take each: unassociated and unapproved, so no line
 * is guessed (design Q2, R4.3). Idempotent: a clip already brought in is
 * skipped. The old rows are read, never changed.
 */
async function importLegacy(sequelize, { episodeId, userId = null }) {
  await episodeState(sequelize, episodeId);
  const clips = await rows(sequelize, `SELECT v.* FROM script_voice_clips v
    WHERE v.episode_id = :episodeId
      AND NOT EXISTS (SELECT 1 FROM voice_source_assets s WHERE s.legacy_voice_clip_id = v.id)
    ORDER BY v.created_at`, { episodeId });
  const imported = [];
  const failed = [];
  for (const clip of clips) {
    const local = await media().tmpPath(`legacy-${clip.id}`);
    try {
      await media().download(clip.s3_key, local);
      const probe = await media().probe(local);
      if (!probe.hasAudio || !probe.duration_ms) { failed.push({ clip_id: clip.id, reason: 'no_audio' }); continue; }
      const sha = await media().sha256File(local);
      const { size } = await fs.promises.stat(local);
      const out = await sequelize.transaction(async (t) => {
        const [source] = await rows(sequelize, `INSERT INTO voice_source_assets
          (episode_id, source_kind, s3_key, sha256, content_type, file_size_bytes, duration_ms, sample_rate, channels, original_filename, legacy_voice_clip_id, created_by)
          VALUES (:episodeId, 'legacy', :key, :sha, :type, :size, :duration, :rate, :channels, :name, :clipId, :userId)
          ON CONFLICT DO NOTHING RETURNING *`, {
          episodeId, key: clip.s3_key, sha, type: clip.content_type || 'application/octet-stream', size, duration: probe.duration_ms,
          rate: probe.sample_rate, channels: probe.channels, name: `voice-beat-${clip.beat_number}-line-${clip.line_index}`, clipId: clip.id, userId,
        }, t);
        if (!source) return null;
        const label = `Old clip: beat ${clip.beat_number}, line ${clip.line_index + 1} (${clip.speaker})`;
        const [candidate] = await rows(sequelize, `INSERT INTO line_voice_candidates (episode_id, source_asset_id, label, created_by)
          VALUES (:episodeId, :sourceId, :label, :userId) RETURNING id`, { episodeId, sourceId: source.id, label, userId }, t);
        await insertRevision(sequelize, candidate.id, 1, readSettings({}, probe.duration_ms), userId, t);
        return { clip_id: clip.id, source_id: source.id, candidate_id: candidate.id };
      });
      if (out) imported.push(out);
    } catch (err) {
      console.error(`[voiceStudio] legacy clip ${clip.id} not brought in:`, err.message);
      failed.push({ clip_id: clip.id, reason: 'error', message: err.message });
    } finally {
      await media().removeFile(local);
    }
  }
  const already = await one(sequelize, `SELECT count(*)::int AS n FROM voice_source_assets
    WHERE episode_id = :episodeId AND source_kind = 'legacy'`, { episodeId });
  return { imported, failed, legacy_sources: already.n };
}

module.exports = {
  VoiceStudioError, STATE_REASONS, STATES, AUDIO_EXTS, MAX_SECONDS, isPlayable,
  setMedia, readAudioProbe, readSettings, settingsHash, episodeState,
  createSource, createCandidate, reviseCandidate, associate, approve, resolveApproval, revokeApproval,
  summary, playableApprovals, approvalHistory, reconfirm, removeCandidate, listTakes, importLegacy,
  referencedScriptVersionIds,
};
