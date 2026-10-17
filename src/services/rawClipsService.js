'use strict';

/**
 * Raw clips (episode_raw_clips): the episode's raw, unedited video clips,
 * uploaded on Assets → Files (Evoni, 2026-10-17), one row per clip, naming
 * who is on camera. Raw SQL, like episode_performance_clips. Reads and
 * writes only this table, and reads episodes to check the episode exists.
 *
 * The file work (ffprobe, thumbnail, green removal, S3) is in
 * rawClipMedia.js; the pure pieces it needs (command arguments, key colour)
 * are here so they can be tested without ffmpeg.
 */

const PERFORMERS = Object.freeze(['lala', 'justawoman', 'guest']);
const KEY_STATUSES = Object.freeze(['none', 'queued', 'processing', 'done', 'failed']);
const KEY_STRENGTHS = Object.freeze(['low', 'medium', 'high']);

const COLUMNS = `id, episode_id, show_id, performer, guest_name, label, beat_number, original_filename, content_type,
  file_size_bytes, duration_seconds, width, height, url_raw, thumbnail_url,
  key_status, key_strength, url_cutout, key_error, key_started_at, key_finished_at, created_at, updated_at`;

// A job still queued or processing this long after its last update was cut
// off (the server restarted mid-job); list marks it failed so Retry shows.
const STALE_HOURS = 3;
const STALE_MESSAGE = 'Stopped before it finished (the server restarted). Press Retry.';

class RawClipError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const cleanText = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Validates the editable fields. Returns { performer, guest_name, label,
 * beat_number } (only the keys given). beat_number links the clip to a
 * scene (canonical beat 1-14); null unlinks it.
 */
function readFields(body = {}, { requirePerformer = false } = {}) {
  const out = {};
  if (body.performer !== undefined || requirePerformer) {
    if (!PERFORMERS.includes(body.performer)) throw new RawClipError(400, `performer must be one of ${PERFORMERS.join(', ')}`);
    out.performer = body.performer;
  }
  if (body.guest_name !== undefined) out.guest_name = cleanText(body.guest_name, 200);
  if (body.label !== undefined) out.label = cleanText(body.label, 200);
  if (body.beat_number !== undefined) {
    if (body.beat_number === null || body.beat_number === '') out.beat_number = null;
    else {
      const beat = Number(body.beat_number);
      if (!Number.isInteger(beat) || beat < 1 || beat > 14) throw new RawClipError(400, 'beat_number must be a whole number from 1 to 14, or null');
      out.beat_number = beat;
    }
  }
  if (out.performer && out.performer !== 'guest') out.guest_name = null;
  return out;
}

function readStrength(value) {
  const s = value == null || value === '' ? 'medium' : value;
  if (!KEY_STRENGTHS.includes(s)) throw new RawClipError(400, `strength must be one of ${KEY_STRENGTHS.join(', ')}`);
  return s;
}

const truthy = (v) => v === true || v === 'true' || v === '1' || v === 1 || v === 'on';

async function findEpisode(sequelize, episodeId) {
  const [[episode]] = await sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId } });
  if (!episode) throw new RawClipError(404, 'Episode not found');
  return episode;
}

/**
 * The episode's live clips, oldest first. Jobs left queued or processing
 * past STALE_HOURS (and not running now: activeIds) are marked failed first.
 */
async function listClips(sequelize, episodeId, { activeIds = [] } = {}) {
  await sequelize.query(
    `UPDATE episode_raw_clips
        SET key_status = 'failed', key_error = :message, updated_at = NOW()
      WHERE episode_id = :episodeId AND deleted_at IS NULL
        AND key_status IN ('queued', 'processing')
        AND updated_at < NOW() - INTERVAL '${STALE_HOURS} hours'
        ${activeIds.length ? 'AND id NOT IN (:activeIds)' : ''}`,
    { replacements: { episodeId, message: STALE_MESSAGE, activeIds } });
  const [rows] = await sequelize.query(
    `SELECT ${COLUMNS} FROM episode_raw_clips
      WHERE episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    { replacements: { episodeId } });
  return rows || [];
}

/** One live clip of the episode, with its S3 keys (for the media work), or null. */
async function getClip(sequelize, episodeId, clipId) {
  const [[row]] = await sequelize.query(
    `SELECT ${COLUMNS}, s3_key_raw, thumbnail_key, s3_key_cutout FROM episode_raw_clips
      WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId, clipId } });
  return row || null;
}

/** Inserts a clip row. clip: the columns, already validated. Returns the row. */
async function createClip(sequelize, clip) {
  const replacements = {
    id: clip.id, episodeId: clip.episode_id, showId: clip.show_id || null,
    performer: clip.performer, guestName: clip.guest_name || null, label: clip.label || null,
    originalFilename: clip.original_filename || null, contentType: clip.content_type || null,
    size: clip.file_size_bytes ?? null, duration: clip.duration_seconds ?? null,
    width: clip.width ?? null, height: clip.height ?? null,
    keyRaw: clip.s3_key_raw, urlRaw: clip.url_raw || null,
    thumbKey: clip.thumbnail_key || null, thumbUrl: clip.thumbnail_url || null,
    keyStatus: clip.key_status || 'none', keyStrength: clip.key_strength || 'medium',
  };
  const [[row]] = await sequelize.query(
    `INSERT INTO episode_raw_clips
       (id, episode_id, show_id, performer, guest_name, label, original_filename, content_type,
        file_size_bytes, duration_seconds, width, height, s3_key_raw, url_raw, thumbnail_key, thumbnail_url,
        key_status, key_strength, created_at, updated_at)
     VALUES (:id, :episodeId, :showId, :performer, :guestName, :label, :originalFilename, :contentType,
        :size, :duration, :width, :height, :keyRaw, :urlRaw, :thumbKey, :thumbUrl,
        :keyStatus, :keyStrength, NOW(), NOW())
     RETURNING ${COLUMNS}`,
    { replacements });
  return row;
}

/** Updates performer, guest_name, label and beat_number. Returns the row, or null when there is no such clip. */
async function updateClip(sequelize, episodeId, clipId, body = {}) {
  const fields = readFields(body);
  const keys = Object.keys(fields);
  if (!keys.length) throw new RawClipError(400, 'Nothing to change: send performer, guest_name, label or beat_number');
  const sets = keys.map((k) => `${k} = :${k}`).join(', ');
  const [rows] = await sequelize.query(
    `UPDATE episode_raw_clips SET ${sets}, updated_at = NOW()
      WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL
      RETURNING ${COLUMNS}`,
    { replacements: { ...fields, episodeId, clipId } });
  return (rows || [])[0] || null;
}

/** Sets the green-removal state. extra: { strength, cutoutKey, cutoutUrl, error }. */
async function setKeyState(sequelize, clipId, status, extra = {}) {
  if (!KEY_STATUSES.includes(status)) throw new RawClipError(400, `key_status must be one of ${KEY_STATUSES.join(', ')}`);
  const sets = ['key_status = :status', 'updated_at = NOW()'];
  const replacements = { clipId, status };
  if (extra.strength) { sets.push('key_strength = :strength'); replacements.strength = extra.strength; }
  if (status === 'queued') sets.push('key_error = NULL', 'key_started_at = NULL', 'key_finished_at = NULL');
  if (status === 'processing') sets.push('key_started_at = NOW()');
  if (status === 'done') {
    sets.push('s3_key_cutout = :cutoutKey', 'url_cutout = :cutoutUrl', 'key_error = NULL', 'key_finished_at = NOW()');
    replacements.cutoutKey = extra.cutoutKey;
    replacements.cutoutUrl = extra.cutoutUrl;
  }
  if (status === 'failed') {
    sets.push('key_error = :error', 'key_finished_at = NOW()');
    replacements.error = String(extra.error || 'Green removal failed').slice(0, 1000);
  }
  const [rows] = await sequelize.query(
    `UPDATE episode_raw_clips SET ${sets.join(', ')} WHERE id = :clipId AND deleted_at IS NULL RETURNING ${COLUMNS}`,
    { replacements });
  return (rows || [])[0] || null;
}

/** Soft-deletes one of the episode's clips (its files stay in S3). True when one was removed. */
async function removeClip(sequelize, episodeId, clipId) {
  const [rows] = await sequelize.query(
    `UPDATE episode_raw_clips SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL
      RETURNING id`,
    { replacements: { episodeId, clipId } });
  return (rows || []).length > 0;
}

// ── Green removal: pure pieces ─────────────────────────────────────────────

// chromakey similarity per strength (how far from the key colour still keys
// out); blend softens the edge.
const STRENGTH_SIMILARITY = Object.freeze({ low: 0.1, medium: 0.16, high: 0.24 });
const DEFAULT_KEY_COLOR = '0x00B140'; // chroma-key green

/**
 * The key colour from a small RGB frame (rgb24, size x size): the average of
 * the green-dominant pixels on the frame's edge, where the screen is.
 * Falls back to chroma-key green when the edge is not green.
 */
function pickKeyColor(rgb, size = 16) {
  if (!rgb || rgb.length < size * size * 3) return DEFAULT_KEY_COLOR;
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (y !== 0 && y !== size - 1 && x !== 0 && x !== size - 1) continue;
      const i = (y * size + x) * 3;
      const pr = rgb[i]; const pg = rgb[i + 1]; const pb = rgb[i + 2];
      if (pg > pr + 30 && pg > pb + 30) { r += pr; g += pg; b += pb; n += 1; }
    }
  }
  // Under a quarter of the edge green: not a green-screen frame to sample.
  if (n < (size * 4 - 4) / 4) return DEFAULT_KEY_COLOR;
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0').toUpperCase();
  return `0x${hex(r)}${hex(g)}${hex(b)}`;
}

/** ffmpeg arguments: input → WebM (VP9 with alpha, Opus audio), green keyed out, longest side at most 1920. */
function chromakeyArgs(input, output, { color = DEFAULT_KEY_COLOR, strength = 'medium' } = {}) {
  const similarity = STRENGTH_SIMILARITY[strength] ?? STRENGTH_SIMILARITY.medium;
  const filter = [
    "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'",
    `chromakey=color=${color}:similarity=${similarity}:blend=0.08`,
    'despill=type=green',
    'format=yuva420p',
  ].join(',');
  return [
    '-hide_banner', '-y', '-i', input,
    '-vf', filter,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32',
    '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-threads', '2', '-auto-alt-ref', '0',
    '-c:a', 'libopus', '-b:a', '128k',
    output,
  ];
}

/** ffmpeg arguments: one frame at `at` seconds, size x size, raw rgb24 to stdout (for pickKeyColor). */
function sampleFrameArgs(input, at = 1, size = 16) {
  return ['-hide_banner', '-ss', String(at), '-i', input, '-frames:v', '1', '-vf', `scale=${size}:${size}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'];
}

/** ffmpeg arguments: a 480px-wide JPEG thumbnail at `at` seconds. */
function thumbnailArgs(input, output, at = 1) {
  return ['-hide_banner', '-y', '-ss', String(at), '-i', input, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', output];
}

/** ffprobe arguments: the format and streams as JSON. */
function probeArgs(input) {
  return ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input];
}

/** { duration_seconds, width, height, hasVideo } from ffprobe's JSON output. */
function readProbe(json) {
  let data = json;
  if (typeof json === 'string') {
    try { data = JSON.parse(json); } catch (err) {
      console.error('[rawClips] ffprobe output is not JSON:', err.message);
      return { duration_seconds: null, width: null, height: null, hasVideo: false };
    }
  }
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  const video = streams.find((s) => s.codec_type === 'video');
  const duration = Number(data?.format?.duration ?? video?.duration);
  return {
    duration_seconds: Number.isFinite(duration) ? Math.round(duration * 100) / 100 : null,
    width: video?.width ? Number(video.width) : null,
    height: video?.height ? Number(video.height) : null,
    hasVideo: Boolean(video),
  };
}

module.exports = {
  PERFORMERS, KEY_STATUSES, KEY_STRENGTHS, STALE_HOURS, STALE_MESSAGE, DEFAULT_KEY_COLOR, STRENGTH_SIMILARITY,
  RawClipError, readFields, readStrength, truthy, findEpisode,
  listClips, getClip, createClip, updateClip, setKeyState, removeClip,
  pickKeyColor, chromakeyArgs, sampleFrameArgs, thumbnailArgs, probeArgs, readProbe,
};
