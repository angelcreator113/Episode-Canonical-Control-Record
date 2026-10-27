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
 *   valid only while (1) in force, (2) for the take's latest revision,
 *   (3) the script is as it was approved or re-confirmed, and (4) the line
 *   still resolves bound with the approved context (design E1, R4.1).
 * - Nothing approves or re-confirms by itself. A write that finds (4) broken
 *   records the approval invalid; it is never valid again.
 *
 * Condition (3) is held by two pins taken when an approval or a
 * re-confirmation is written: the script revision and the episode row's
 * updated_at. The revision alone is a hash of the text, so a script put back
 * to the approved words (A -> B -> A) has the approved revision again; the
 * row's updated_at changes with every save (and with other episode edits),
 * so the pair never mistakes a restored script for an unchanged one.
 * (Implementation finding, reported to Evoni with this change: design R3.2
 * assumed a restore gives a new revision.)
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
  needs_reconfirm: 'The script was saved since this take was approved or re-confirmed.',
});

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
 * updated_at (text) }. lock: 'share' (a voice write checks the script against
 * a save in flight; scriptSave holds FOR UPDATE) or none.
 */
async function episodeState(sequelize, episodeId, t, { lock = null } = {}) {
  checkId(episodeId, 'Episode');
  const row = await one(sequelize, `SELECT id, script_content, script_line_keys, COALESCE(updated_at::text, 'none') AS updated_at, deleted_at
    FROM episodes WHERE id = :episodeId${lock === 'share' ? ' FOR SHARE' : ''}`, { episodeId }, t);
  if (!row || row.deleted_at) fail(404, 'NOT_FOUND', 'Episode not found');
  const script = typeof row.script_content === 'string' ? row.script_content : '';
  return { script, revision: scriptRevision(script, row.script_line_keys ?? null), updated_at: row.updated_at };
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
      const approvals = await rows(sequelize, `SELECT id FROM line_voice_approvals
        WHERE candidate_id = :candidateId AND superseded_at IS NULL AND invalidated_at IS NULL AND deleted_at IS NULL`, { candidateId }, t);
      for (const a of approvals) await invalidate(sequelize, a.id, 'take_reassigned', t);
    }
    return { association: row };
  });
}

// ── Approval state (design E1) ───────────────────────────────────────────────

const pinsMatch = (pin, state) => pin && pin.pinned_script_revision === state.revision && pin.pinned_episode_updated_at === state.updated_at;

/**
 * An approval's state now: { state, reason, resolution }. state: valid |
 * needs_reconfirm | invalid | unbound | outdated_take. `contexts` is
 * lineContexts of the current script; `state` the episode state.
 */
async function evaluate(sequelize, approval, contexts, state, t) {
  if (approval.invalidated_at) return { state: 'invalid', reason: approval.invalidated_reason };
  const candidate = await one(sequelize, 'SELECT deleted_at FROM line_voice_candidates WHERE id = :id', { id: approval.candidate_id }, t);
  if (!candidate || candidate.deleted_at) return { state: 'invalid', reason: 'take_removed' };
  const latest = await latestRevision(sequelize, approval.candidate_id, t);
  if (!latest || latest.id !== approval.candidate_revision_id) return { state: 'outdated_take', reason: 'take_changed' };
  const assoc = await currentAssociation(sequelize, approval.candidate_id, t);
  if (!assoc || assoc.id !== approval.association_id) return { state: 'unbound', reason: 'take_reassigned' };
  const resolution = lc.resolve(approval.approved_context, contexts);
  if (resolution.status !== 'bound') return { state: 'unbound', reason: resolution.reason, resolution };
  if (pinsMatch(approval, state)) return { state: 'valid', reason: null, resolution };
  const confirmation = await one(sequelize, `SELECT pinned_script_revision, pinned_episode_updated_at
    FROM line_voice_reconfirmations WHERE approval_id = :id AND deleted_at IS NULL ORDER BY confirmed_at DESC, created_at DESC LIMIT 1`, { id: approval.id }, t);
  if (pinsMatch(confirmation, state)) return { state: 'valid', reason: null, resolution };
  return { state: 'needs_reconfirm', reason: 'needs_reconfirm', resolution };
}

// Every column the state needs. The pin is text, as episodeState reads updated_at (microseconds kept).
const APPROVAL_COLUMNS = `a.id, a.episode_id, a.candidate_id, a.candidate_revision_id, a.association_id, a.beat_number, a.line_index,
  a.occurrence, a.approved_context, a.approved_context_hash, a.pinned_script_revision,
  a.pinned_episode_updated_at, a.approved_by, a.approved_at, a.superseded_at,
  a.superseded_by, a.invalidated_at, a.invalidated_reason, a.deleted_at`;

async function invalidate(sequelize, approvalId, reason, t) {
  await q(sequelize, `UPDATE line_voice_approvals SET invalidated_at = NOW(), invalidated_reason = :reason, updated_at = NOW()
    WHERE id = :approvalId AND invalidated_at IS NULL`, { approvalId, reason: String(reason || 'line_removed').slice(0, 40) }, t);
}

/**
 * Approves a take's revision for the line it is tied to, against the current
 * saved script. The revision must be the take's latest and its association
 * current and bound now. A current approval at that line, or of this take,
 * is superseded when still valid and recorded invalid when not.
 */
async function approve(sequelize, { episodeId, candidateId, candidateRevisionId, scriptRevision: sent, userId }) {
  if (!userId) fail(401, 'AUTH_REQUIRED', 'Sign in to approve');
  checkId(candidateRevisionId, 'Take revision');
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

      // Every approval still listed for this line or this take (invalid ones included) is superseded by the
      // new one; one that no longer matches its line is first recorded invalid, so it stays invalid in its history.
      const others = await rows(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a
        WHERE a.episode_id = :episodeId AND a.superseded_at IS NULL AND a.deleted_at IS NULL
          AND ((a.beat_number = :beat AND a.line_index = :index) OR a.candidate_id = :candidateId)
        FOR UPDATE`, { episodeId, beat: assoc.beat_number, index: resolution.line_index, candidateId }, t);
      const toSupersede = [];
      for (const other of others) {
        const e = await evaluate(sequelize, other, contexts, state, t);
        if (e.state === 'unbound') await invalidate(sequelize, other.id, e.reason, t);
        toSupersede.push(other.id);
      }
      // Superseded before the insert, so the one-current-approval index holds.
      if (toSupersede.length) {
        await q(sequelize, 'UPDATE line_voice_approvals SET superseded_at = NOW(), updated_at = NOW() WHERE id IN (:ids)', { ids: toSupersede }, t);
      }
      const context = lc.associationOf({ ...assoc });
      const [row] = await rows(sequelize, `INSERT INTO line_voice_approvals
        (episode_id, candidate_id, candidate_revision_id, association_id, beat_number, line_index, occurrence,
         approved_context, approved_context_hash, pinned_script_revision, pinned_episode_updated_at, approved_by)
        SELECT :episodeId, :candidateId, :revisionId, :assocId, :beat, :index, :occurrence,
         CAST(:context AS jsonb), :contextHash, :rev, COALESCE(e.updated_at::text, 'none'), :userId
        FROM episodes e WHERE e.id = :episodeId RETURNING id`, {
        episodeId, candidateId, revisionId: latest.id, assocId: assoc.id, beat: assoc.beat_number, index: assoc.line_index,
        occurrence: assoc.occurrence, context: JSON.stringify(context), contextHash: assoc.context_hash, rev: state.revision, userId,
      }, t);
      if (toSupersede.length) {
        await q(sequelize, 'UPDATE line_voice_approvals SET superseded_by = :to WHERE id IN (:ids)', { ids: toSupersede, to: row.id }, t);
      }
      return { approval_id: row.id, superseded: toSupersede };
    });
  } catch (err) {
    if ((err?.original?.code || err?.parent?.code) === '23505') {
      console.error('[voiceStudio] two approvals for one line at once:', err.message);
      fail(409, 'APPROVAL_RACE', 'Another approval for this line was saved at the same moment. Reload and try again.');
    }
    throw err;
  }
}

/** Every current approval with its state, and counts by episode and beat. */
async function summary(sequelize, { episodeId }) {
  return sequelize.transaction(async (t) => {
    const state = await episodeState(sequelize, episodeId, t);
    const contexts = lc.lineContexts(state.script);
    const approvals = await rows(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a
      WHERE a.episode_id = :episodeId AND a.superseded_at IS NULL AND a.deleted_at IS NULL ORDER BY a.beat_number, a.line_index`, { episodeId }, t);
    const items = [];
    for (const a of approvals) {
      const e = await evaluate(sequelize, a, contexts, state, t);
      items.push({
        approval_id: a.id, candidate_id: a.candidate_id, candidate_revision_id: a.candidate_revision_id,
        beat_number: a.beat_number, line_index: a.line_index, words: a.approved_context?.words || null,
        speaker: a.approved_context?.speaker_written || null, context_hash: a.approved_context_hash,
        state: e.state, reason: e.reason, reason_text: e.reason ? STATE_REASONS[e.reason] || e.reason : null,
        resolution: e.resolution || null, approved_by: a.approved_by, approved_at: a.approved_at,
      });
    }
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
 * A person's re-confirmation of approvals that still match their lines
 * (design R5.2). One transaction: the script revision must be current
 * (else 409, nothing written); each item is re-checked and confirmed only
 * when it needs re-confirming and its context hash is the one shown.
 * items: [{ approval_id, context_hash }].
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
      const a = await one(sequelize, `SELECT ${APPROVAL_COLUMNS} FROM line_voice_approvals a WHERE a.id = :id AND a.episode_id = :episodeId FOR UPDATE`, { id, episodeId }, t);
      if (!a || a.deleted_at || a.superseded_at) { refused.push({ approval_id: id, reason: 'not_found' }); continue; }
      // The take's row is locked so a re-trim cannot land between the check and the write.
      await q(sequelize, 'SELECT id FROM line_voice_candidates WHERE id = :cid FOR UPDATE', { cid: a.candidate_id }, t);
      const e = await evaluate(sequelize, a, contexts, state, t);
      if (e.state === 'valid') { refused.push({ approval_id: id, reason: 'already_valid' }); continue; }
      if (e.state !== 'needs_reconfirm') {
        if (e.state === 'unbound') await invalidate(sequelize, a.id, e.reason, t);
        refused.push({ approval_id: id, reason: e.reason, reason_text: STATE_REASONS[e.reason] || e.reason });
        continue;
      }
      if (item.context_hash !== a.approved_context_hash) { refused.push({ approval_id: id, reason: 'context_mismatch' }); continue; }
      await q(sequelize, `INSERT INTO line_voice_reconfirmations (approval_id, pinned_script_revision, pinned_episode_updated_at, context_hash, confirmed_by)
        SELECT :id, :rev, COALESCE(e.updated_at::text, 'none'), :hash, :userId FROM episodes e WHERE e.id = :episodeId`,
      { id, rev: state.revision, hash: a.approved_context_hash, userId, episodeId }, t);
      confirmed.push(id);
    }
    return { script_revision: state.revision, confirmed, refused };
  });
}

/** Removes a take (soft delete). Its source stays; a current approval of it is recorded invalid. */
async function removeCandidate(sequelize, { episodeId, candidateId }) {
  return sequelize.transaction(async (t) => {
    await episodeState(sequelize, episodeId, t);
    await candidateRow(sequelize, episodeId, candidateId, t, { lock: true });
    await q(sequelize, 'UPDATE line_voice_candidates SET deleted_at = NOW(), updated_at = NOW() WHERE id = :candidateId', { candidateId }, t);
    const current = await rows(sequelize, `SELECT id FROM line_voice_approvals
      WHERE candidate_id = :candidateId AND superseded_at IS NULL AND invalidated_at IS NULL AND deleted_at IS NULL`, { candidateId }, t);
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
  VoiceStudioError, STATE_REASONS, AUDIO_EXTS, MAX_SECONDS,
  setMedia, readAudioProbe, readSettings, settingsHash, episodeState,
  createSource, createCandidate, reviseCandidate, associate, approve, summary, reconfirm, removeCandidate, listTakes, importLegacy,
};
