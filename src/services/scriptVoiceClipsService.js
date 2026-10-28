'use strict';

/**
 * Voice clips (script_voice_clips; Teleprompter batch 3, Evoni, 2026-10-20):
 * a line of the script spoken by Evoni, as Lala or anyone else, for the
 * teleprompter to play when she reads opposite it. Raw SQL, like
 * rawClipsService; the audio file goes to S3 the raw clips' way
 * (rawClipMedia.uploadFile).
 *
 * A line is (episode, beat_number, line_index), line_index counted as the
 * teleprompter counts a beat's lines (frontend lib/teleprompterLines).
 * line_text is the line as it was when recorded, so the pages can say
 * "line changed since recorded". One live clip per line: saving a new one
 * soft-deletes the old one in the same transaction (and a partial unique
 * index holds it).
 *
 * Who may change a clip (V-1, Evoni, 2026-10-28): replacing a line's live
 * clip (by uploading over it) or removing one is for the clip's recorder
 * (created_by, the signed-in user's id) or an admin (the ADMIN group). A
 * clip with no recorder on record is an admin's only. The check runs in
 * the same transaction as the change, on the locked row, so a clip saved
 * a moment before can't be taken over. Recording a line that has no live
 * clip is open to any signed-in user, as before.
 *
 * The table arrives with 20261020120000-create-teleprompter-remote-and-voice-clips.js,
 * which runs only through the Deploy workflow; until then every call is a
 * 409 that says so (Postgres 42P01).
 */

const { userInGroup } = require('../middleware/auth');

const TABLE = 'script_voice_clips';
const NOT_READY = "Voice clips aren't switched on yet: the database update that adds them (20261020120000) hasn't run.";
const MAX_SECONDS = 600;
const NOT_YOURS = "Someone else recorded this line's clip. Only they or an admin can replace or remove it.";

const COLUMNS = `id, episode_id, beat_number, line_index, speaker, line_text, url, content_type,
  duration_seconds, file_size_bytes, created_by, created_at, updated_at`;

class VoiceClipError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

const missingTable = (err) => {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const text = String(err?.original?.message || err?.message || '');
  return (code === '42P01' || /relation .* does not exist/i.test(text)) && text.includes(TABLE);
};

async function guarded(what, fn) {
  try {
    return await fn();
  } catch (err) {
    if (missingTable(err)) {
      console.error(`[scriptVoiceClips] ${what}: ${TABLE} is missing (migration 20261020120000 not run):`, err.message);
      throw new VoiceClipError(409, NOT_READY, 'MIGRATION_PENDING');
    }
    if ((err?.original?.code || err?.parent?.code) === '23505') {
      console.error(`[scriptVoiceClips] ${what}: two saves for one line at once:`, err.message);
      throw new VoiceClipError(409, 'Another clip for this line was saved at the same moment. Try again.');
    }
    throw err;
  }
}

/** Whether user may replace or remove clip ({ created_by }): its recorder, or an admin. */
function mayChange(user, clip) {
  if (!user) return false;
  if (userInGroup(user, 'admin')) return true;
  return !!clip.created_by && !!user.id && String(clip.created_by) === String(user.id);
}

const refuseUnlessMayChange = (user, clip) => {
  if (!mayChange(user, clip)) throw new VoiceClipError(403, NOT_YOURS, 'NOT_CLIP_OWNER');
};

/** Whether the table is there (before an upload, so no file goes to S3 for nothing). */
async function ensureTable(sequelize) {
  const [[row]] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` } });
  if (!row || !row.reg) {
    console.error(`[scriptVoiceClips] ${TABLE} is missing (migration 20261020120000 not run)`);
    throw new VoiceClipError(409, NOT_READY, 'MIGRATION_PENDING');
  }
}

const wholeNumber = (v, lo, hi, name) => {
  const n = Number(v);
  if (v === '' || v == null || !Number.isInteger(n) || n < lo || n > hi) throw new VoiceClipError(400, `${name} must be a whole number from ${lo} to ${hi}`);
  return n;
};

/**
 * Validates an upload's fields: beat_number (1+), line_index (0+), speaker,
 * line_text (both required), duration_seconds (optional, up to 10 minutes).
 */
function readFields(body = {}) {
  const speaker = typeof body.speaker === 'string' ? body.speaker.trim().slice(0, 120) : '';
  if (!speaker) throw new VoiceClipError(400, 'speaker is required');
  const lineText = typeof body.line_text === 'string' ? body.line_text.trim().slice(0, 5000) : '';
  if (!lineText) throw new VoiceClipError(400, 'line_text is required');
  let duration = null;
  if (body.duration_seconds !== undefined && body.duration_seconds !== '' && body.duration_seconds !== null) {
    const d = Number(body.duration_seconds);
    if (!Number.isFinite(d) || d <= 0 || d > MAX_SECONDS) throw new VoiceClipError(400, `duration_seconds must be more than 0 and at most ${MAX_SECONDS}`);
    duration = Math.round(d * 100) / 100;
  }
  return {
    beat_number: wholeNumber(body.beat_number, 1, 100000, 'beat_number'),
    line_index: wholeNumber(body.line_index, 0, 100000, 'line_index'),
    speaker,
    line_text: lineText,
    duration_seconds: duration,
  };
}

const shape = (row) => (row ? {
  ...row,
  duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
  file_size_bytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
} : row);

async function findEpisode(sequelize, episodeId) {
  const [[episode]] = await sequelize.query(
    'SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId } });
  if (!episode) throw new VoiceClipError(404, 'Episode not found');
  return episode;
}

/** The episode's live voice clips, by beat and line. */
async function listClips(sequelize, episodeId) {
  return guarded('list', async () => {
    const [rows] = await sequelize.query(
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE episode_id = :episodeId AND deleted_at IS NULL
        ORDER BY beat_number ASC, line_index ASC`,
      { replacements: { episodeId } });
    return (rows || []).map(shape);
  });
}

/** The line's live clip ({ id, created_by }), or null; locked when a transaction is given. */
async function lineClip(sequelize, { episodeId, beatNumber, lineIndex }, transaction = undefined) {
  return guarded('read line', async () => {
    const [rows] = await sequelize.query(
      `SELECT id, created_by FROM ${TABLE}
        WHERE episode_id = :episodeId AND beat_number = :beat AND line_index = :line AND deleted_at IS NULL
        ${transaction ? 'FOR UPDATE' : ''}`,
      { replacements: { episodeId, beat: beatNumber, line: lineIndex }, ...(transaction ? { transaction } : {}) });
    return (rows || [])[0] || null;
  });
}

/**
 * Before an upload goes to S3: refuses (403 NOT_CLIP_OWNER) when the line
 * has a live clip that user may not replace. saveClip checks again, in its
 * transaction; this only spares a file that would be refused.
 */
async function checkMayRecord(sequelize, user, line) {
  const live = await lineClip(sequelize, line);
  if (live) refuseUnlessMayChange(user, live);
}

/**
 * Saves a clip as the line's live one: the line's earlier live clip is
 * soft-deleted first, in one transaction. clip: the validated fields plus
 * id, episode_id, s3_key, url, content_type, file_size_bytes, created_by.
 * user (req.user) must be allowed to replace the earlier clip (mayChange),
 * checked on the locked row; otherwise 403 NOT_CLIP_OWNER and nothing changes.
 * Returns { clip, replaced } (replaced: the id of the clip it took over from, or null).
 */
async function saveClip(sequelize, clip, user) {
  return guarded('save', () => sequelize.transaction(async (transaction) => {
    const live = await lineClip(sequelize, { episodeId: clip.episode_id, beatNumber: clip.beat_number, lineIndex: clip.line_index }, transaction);
    if (live) refuseUnlessMayChange(user, live);
    const [old] = await sequelize.query(
      `UPDATE ${TABLE} SET deleted_at = NOW(), updated_at = NOW()
        WHERE episode_id = :episodeId AND beat_number = :beat AND line_index = :line AND deleted_at IS NULL
        RETURNING id`,
      { replacements: { episodeId: clip.episode_id, beat: clip.beat_number, line: clip.line_index }, transaction });
    const [[row]] = await sequelize.query(
      `INSERT INTO ${TABLE}
         (id, episode_id, beat_number, line_index, speaker, line_text, s3_key, url, content_type,
          duration_seconds, file_size_bytes, created_by, created_at, updated_at)
       VALUES (:id, :episodeId, :beat, :line, :speaker, :lineText, :s3Key, :url, :contentType,
          :duration, :size, :createdBy, NOW(), NOW())
       RETURNING ${COLUMNS}`,
      {
        replacements: {
          id: clip.id, episodeId: clip.episode_id, beat: clip.beat_number, line: clip.line_index,
          speaker: clip.speaker, lineText: clip.line_text, s3Key: clip.s3_key, url: clip.url,
          contentType: clip.content_type || null, duration: clip.duration_seconds ?? null,
          size: clip.file_size_bytes ?? null, createdBy: clip.created_by || null,
        },
        transaction,
      });
    return { clip: shape(row), replaced: (old || [])[0]?.id || null };
  }));
}

/**
 * Soft-deletes one of the episode's clips (the file stays in S3). True when
 * one was removed, false when there is no such live clip. user (req.user)
 * must be its recorder or an admin (mayChange); otherwise 403 NOT_CLIP_OWNER.
 */
async function removeClip(sequelize, episodeId, clipId, user) {
  return guarded('delete', () => sequelize.transaction(async (transaction) => {
    const [found] = await sequelize.query(
      `SELECT id, created_by FROM ${TABLE}
        WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL FOR UPDATE`,
      { replacements: { episodeId, clipId }, transaction });
    const clip = (found || [])[0];
    if (!clip) return false;
    refuseUnlessMayChange(user, clip);
    const [rows] = await sequelize.query(
      `UPDATE ${TABLE} SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL RETURNING id`,
      { replacements: { episodeId, clipId }, transaction });
    return (rows || []).length > 0;
  }));
}

/** The clip's S3 key: episodes/<episode>/voice-clips/<id><ext>. */
const clipKey = (episodeId, id, ext) => `episodes/${episodeId}/voice-clips/${id}${ext}`;

module.exports = {
  TABLE, NOT_READY, NOT_YOURS, MAX_SECONDS,
  VoiceClipError, missingTable, ensureTable, readFields, findEpisode,
  mayChange, lineClip, checkMayRecord, listClips, saveClip, removeClip, clipKey,
};
