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

// is_favorite and start_line (Teleprompter batch 2; Evoni, 2026-10-20)
// arrive with 20261020090000-add-episode-raw-clips-favorite-start-line.js,
// which runs only through the Deploy workflow. Read through to_jsonb so the
// same SELECT works before and after it: has_take_fields says whether the
// columns are there, and shapeRow leaves both fields out when they are not.
const TAKE_COLUMNS = `to_jsonb(episode_raw_clips) -> 'is_favorite' AS is_favorite,
  to_jsonb(episode_raw_clips) -> 'start_line' AS start_line,
  (to_jsonb(episode_raw_clips) -> 'is_favorite') IS NOT NULL AS has_take_fields`;
const TAKE_FIELDS = Object.freeze(['is_favorite', 'start_line']);
const TAKE_FIELDS_MISSING = 'Favourites and start lines are not switched on yet: the database update that adds them (20261020090000) has not run. The take is saved; star it once the update is in.';

// beat_marks ("Record whole episode"; Evoni, 2026-10-23): a full-episode
// take's beat markers, [{ beat, t }] (t: seconds into the take), arrive with
// 20261023235900-add-episode-raw-clips-beat-marks.js. Read the same way:
// the key is in to_jsonb(row) only once the column exists (a NULL column is
// JSON null, still there), so has_beat_marks says so and shapeRow leaves
// beat_marks out until then.
const MARKS_COLUMNS = `to_jsonb(episode_raw_clips) -> 'beat_marks' AS beat_marks,
  (to_jsonb(episode_raw_clips) -> 'beat_marks') IS NOT NULL AS has_beat_marks`;
const MAX_BEAT_MARKS = 30;
const MAX_MARK_SECONDS = 36000; // ten hours
const BEAT_MARKS_MISSING = "Beat markers can't be kept yet: the database update that adds them (20261023235900) hasn't run yet. The take itself is saved.";

// end_beat_number (Evoni, 2026-10-28: "show where a video starts and
// ends"): the beat an uploaded clip with no markers ends on, so its card
// reads "Beat 1 → Beat 11". Arrives with
// 20261028120000-add-episode-raw-clips-end-beat-number.js and is read the
// same way: has_end_beat says the column is there; shapeRow leaves the field
// out until then, and a PATCH of it is a 409 that says so.
const END_BEAT_COLUMNS = `to_jsonb(episode_raw_clips) -> 'end_beat_number' AS end_beat_number,
  (to_jsonb(episode_raw_clips) -> 'end_beat_number') IS NOT NULL AS has_end_beat`;
const END_BEAT_MISSING = "The beat a clip ends on can't be saved yet: the database update that adds it (20261028120000) hasn't run yet. Everything else about the clip still works.";
const END_BEAT_RULE = 'end_beat_number must be a whole number from 1 to 14, no earlier than the beat the clip starts on, or null';

const COLUMNS = `id, episode_id, show_id, performer, guest_name, label, beat_number, original_filename, content_type,
  file_size_bytes, duration_seconds, width, height, url_raw, thumbnail_url,
  key_status, key_strength, url_cutout, key_error, key_started_at, key_finished_at, created_at, updated_at,
  ${TAKE_COLUMNS},
  ${MARKS_COLUMNS},
  ${END_BEAT_COLUMNS}`;

// A job still queued or processing this long after its last update was cut
// off (the server restarted mid-job); list marks it failed so Retry shows.
const STALE_HOURS = 3;
const STALE_MESSAGE = 'Stopped before it finished (the server restarted). The original and any earlier cut-out are unchanged. Press Retry.';

class RawClipError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * A row as the API sends it: is_favorite (boolean) and start_line (a whole
 * number or null) only when those columns exist; beat_marks (an array, or
 * null) and end_beat_number (a whole number, or null) only when their
 * columns exist; has_take_fields, has_beat_marks and has_end_beat never.
 */
function shapeRow(row) {
  if (!row || typeof row !== 'object') return row;
  let out = row;
  if ('has_take_fields' in out) {
    const { has_take_fields: has, is_favorite: fav, start_line: line, ...rest } = out;
    out = has ? { ...rest, is_favorite: fav === true || fav === 'true', start_line: line == null ? null : Number(line) } : rest;
  }
  if ('has_beat_marks' in out) {
    const { has_beat_marks: hasMarks, beat_marks: marks, ...rest } = out;
    out = hasMarks ? { ...rest, beat_marks: Array.isArray(marks) ? marks : null } : rest;
  }
  if ('has_end_beat' in out) {
    const { has_end_beat: hasEnd, end_beat_number: end, ...rest } = out;
    const n = end == null ? null : Number(end);
    out = hasEnd ? { ...rest, end_beat_number: Number.isInteger(n) ? n : null } : rest;
  }
  return out;
}

// Postgres 42703: undefined_column. A PATCH of is_favorite / start_line
// before the migration has run is a 409 with a plain message, not a 500.
const missingTakeColumn = (err) => {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const text = String(err?.original?.message || err?.message || '');
  return (code === '42703' || /column .* does not exist/i.test(text)) && TAKE_FIELDS.some((f) => text.includes(f));
};

// The same for beat_marks before 20261023235900 has run.
const missingMarksColumn = (err) => {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const text = String(err?.original?.message || err?.message || '');
  return (code === '42703' || /column .* does not exist/i.test(text)) && text.includes('beat_marks');
};

// The same for end_beat_number before 20261028120000 has run.
const missingEndBeatColumn = (err) => {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const text = String(err?.original?.message || err?.message || '');
  return (code === '42703' || /column .* does not exist/i.test(text)) && text.includes('end_beat_number');
};

/** A beat number 1-14, null for null or '', or undefined when it is anything else. */
const readBeat = (value) => {
  if (value === null || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 14 ? n : undefined;
};

const cleanText = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

const MARKS_RULE = `beat_marks must be a list of at most ${MAX_BEAT_MARKS} { beat, t } markers: beat a whole number from 1 to 14 (each beat once), t seconds from 0 to ${MAX_MARK_SECONDS}`;

/**
 * A full-episode take's beat markers: null, or a list (or its JSON text, as
 * a multipart form sends it) of at most 30 { beat, t }, beat 1-14 once each,
 * t seconds from 0 to 36000. Returns them sorted by time (then beat), t to
 * one decimal; anything else is a 400.
 */
function readBeatMarks(value) {
  if (value === null || value === '') return null;
  let list = value;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (err) {
      console.error('[rawClips] beat_marks is not JSON:', err.message);
      throw new RawClipError(400, MARKS_RULE);
    }
  }
  if (!Array.isArray(list) || list.length > MAX_BEAT_MARKS) throw new RawClipError(400, MARKS_RULE);
  const seen = new Set();
  const marks = list.map((m) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw new RawClipError(400, MARKS_RULE);
    const beat = typeof m.beat === 'string' && m.beat.trim() ? Number(m.beat) : m.beat;
    const t = typeof m.t === 'string' && m.t.trim() ? Number(m.t) : m.t;
    if (!Number.isInteger(beat) || beat < 1 || beat > 14 || seen.has(beat)) throw new RawClipError(400, MARKS_RULE);
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > MAX_MARK_SECONDS) throw new RawClipError(400, MARKS_RULE);
    seen.add(beat);
    return { beat, t: Math.round(t * 10) / 10 };
  });
  return marks.sort((a, b) => a.t - b.t || a.beat - b.beat);
}

/**
 * Validates the editable fields. Returns { performer, guest_name, label,
 * beat_number, end_beat_number, is_favorite, start_line, beat_marks } (only
 * the keys given). beat_number links the clip to a scene (canonical beat
 * 1-14); null unlinks it. end_beat_number is the beat the clip ends on (1-14,
 * not before beat_number when both are sent), or null. is_favorite stars the take for its beat (a boolean); start_line is the
 * line within the beat a teleprompter take was read from (0 = the top), a
 * whole number from 0, or null. beat_marks: readBeatMarks.
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
  if (body.end_beat_number !== undefined) {
    const end = readBeat(body.end_beat_number);
    if (end === undefined) throw new RawClipError(400, END_BEAT_RULE);
    if (end != null && out.beat_number !== undefined) {
      if (out.beat_number == null) throw new RawClipError(400, 'Pick the beat the clip starts on before the beat it ends on');
      if (end < out.beat_number) throw new RawClipError(400, END_BEAT_RULE);
    }
    out.end_beat_number = end;
  }
  if (body.is_favorite !== undefined) {
    const v = body.is_favorite;
    if (v === true || v === 'true') out.is_favorite = true;
    else if (v === false || v === 'false') out.is_favorite = false;
    else throw new RawClipError(400, 'is_favorite must be true or false');
  }
  if (body.start_line !== undefined) {
    if (body.start_line === null || body.start_line === '') out.start_line = null;
    else {
      const line = Number(body.start_line);
      if (!Number.isInteger(line) || line < 0 || line > 100000) throw new RawClipError(400, 'start_line must be a whole number from 0, or null');
      out.start_line = line;
    }
  }
  if (body.beat_marks !== undefined) out.beat_marks = readBeatMarks(body.beat_marks);
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
  return (rows || []).map(shapeRow);
}

/** One live clip of the episode, with its S3 keys (for the media work), or null. */
async function getClip(sequelize, episodeId, clipId) {
  const [[row]] = await sequelize.query(
    `SELECT ${COLUMNS}, s3_key_raw, thumbnail_key, s3_key_cutout FROM episode_raw_clips
      WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId, clipId } });
  return shapeRow(row) || null;
}

/** Inserts a clip row. clip: the columns, already validated. Returns the row. */
async function createClip(sequelize, clip) {
  const replacements = {
    id: clip.id, episodeId: clip.episode_id, showId: clip.show_id || null,
    performer: clip.performer, guestName: clip.guest_name || null, label: clip.label || null,
    beatNumber: clip.beat_number ?? null,
    originalFilename: clip.original_filename || null, contentType: clip.content_type || null,
    size: clip.file_size_bytes ?? null, duration: clip.duration_seconds ?? null,
    width: clip.width ?? null, height: clip.height ?? null,
    keyRaw: clip.s3_key_raw, urlRaw: clip.url_raw || null,
    thumbKey: clip.thumbnail_key || null, thumbUrl: clip.thumbnail_url || null,
    keyStatus: clip.key_status || 'none', keyStrength: clip.key_strength || 'medium',
  };
  const [[row]] = await sequelize.query(
    `INSERT INTO episode_raw_clips
       (id, episode_id, show_id, performer, guest_name, label, beat_number, original_filename, content_type,
        file_size_bytes, duration_seconds, width, height, s3_key_raw, url_raw, thumbnail_key, thumbnail_url,
        key_status, key_strength, created_at, updated_at)
     VALUES (:id, :episodeId, :showId, :performer, :guestName, :label, :beatNumber, :originalFilename, :contentType,
        :size, :duration, :width, :height, :keyRaw, :urlRaw, :thumbKey, :thumbUrl,
        :keyStatus, :keyStrength, NOW(), NOW())
     RETURNING ${COLUMNS}`,
    { replacements });
  return shapeRow(row);
}

/**
 * The clip's end beat checked against its start beat when only the end is
 * sent: the start is read first. Before 20261028120000 has run, a 409.
 * Resolves false when there is no such clip.
 */
async function checkEndBeat(sequelize, episodeId, clipId, end) {
  const [[row]] = await sequelize.query(
    `SELECT beat_number, (to_jsonb(episode_raw_clips) -> 'end_beat_number') IS NOT NULL AS has_end_beat
       FROM episode_raw_clips WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId, clipId } });
  if (!row) return false;
  if (!row.has_end_beat) {
    console.error('[rawClips] end_beat_number column is missing (migration 20261028120000 not run)');
    throw new RawClipError(409, END_BEAT_MISSING);
  }
  if (end == null) return true;
  if (row.beat_number == null) throw new RawClipError(400, 'Pick the beat the clip starts on before the beat it ends on');
  if (end < Number(row.beat_number)) throw new RawClipError(400, END_BEAT_RULE);
  return true;
}

/**
 * Updates performer, guest_name, label, beat_number, end_beat_number,
 * is_favorite, start_line and beat_marks. Returns the row, or null when
 * there is no such clip. Starring a take un-stars the episode's other takes
 * for the same beat, in one transaction: one favourite per beat (Evoni,
 * 2026-10-20). A start beat moved past the clip's end beat clears the end
 * beat (the clip is then that one beat).
 */
async function updateClip(sequelize, episodeId, clipId, body = {}) {
  const fields = readFields(body);
  const keys = Object.keys(fields);
  if (!keys.length) throw new RawClipError(400, 'Nothing to change: send performer, guest_name, label, beat_number, end_beat_number, is_favorite, start_line or beat_marks');
  if ('end_beat_number' in fields && !('beat_number' in fields)) {
    if (!(await checkEndBeat(sequelize, episodeId, clipId, fields.end_beat_number))) return null;
  }
  // beat_marks is JSONB: sent as its JSON text and cast.
  const sets = keys.map((k) => (k === 'beat_marks' ? 'beat_marks = CAST(:beat_marks AS jsonb)' : `${k} = :${k}`)).join(', ');
  const values = 'beat_marks' in fields ? { ...fields, beat_marks: fields.beat_marks == null ? null : JSON.stringify(fields.beat_marks) } : fields;
  const run = async (transaction) => {
    const [rows] = await sequelize.query(
      `UPDATE episode_raw_clips SET ${sets}, updated_at = NOW()
        WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL
        RETURNING ${COLUMNS}`,
      { replacements: { ...values, episodeId, clipId }, transaction });
    let row = shapeRow((rows || [])[0]) || null;
    if (row && 'beat_number' in fields && !('end_beat_number' in fields) && row.end_beat_number != null
      && (row.beat_number == null || row.end_beat_number < Number(row.beat_number))) {
      const [cleared] = await sequelize.query(
        `UPDATE episode_raw_clips SET end_beat_number = NULL, updated_at = NOW()
          WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL
          RETURNING ${COLUMNS}`,
        { replacements: { episodeId, clipId }, transaction });
      row = shapeRow((cleared || [])[0]) || { ...row, end_beat_number: null };
    }
    if (row && fields.is_favorite === true && row.beat_number != null) {
      await sequelize.query(
        `UPDATE episode_raw_clips SET is_favorite = false, updated_at = NOW()
          WHERE episode_id = :episodeId AND beat_number = :beat AND id <> :clipId
            AND is_favorite = true AND deleted_at IS NULL`,
        { replacements: { episodeId, clipId, beat: row.beat_number }, transaction });
    }
    return row;
  };
  try {
    if (fields.is_favorite === true) return await sequelize.transaction((t) => run(t));
    return await run(undefined);
  } catch (err) {
    if (err instanceof RawClipError) throw err;
    if (missingEndBeatColumn(err)) {
      console.error('[rawClips] end_beat_number column is missing (migration 20261028120000 not run):', err.message);
      throw new RawClipError(409, END_BEAT_MISSING);
    }
    if (missingMarksColumn(err)) {
      console.error('[rawClips] beat_marks column is missing (migration 20261023235900 not run):', err.message);
      throw new RawClipError(409, BEAT_MARKS_MISSING);
    }
    if (missingTakeColumn(err)) {
      console.error('[rawClips] is_favorite / start_line columns are missing (migration 20261020090000 not run):', err.message);
      throw new RawClipError(409, TAKE_FIELDS_MISSING);
    }
    console.error('[rawClips] update failed:', err.message);
    throw err;
  }
}

// The take fields an upload may carry whose columns come with a migration
// (Teleprompter audit 8, 2026-10-24): start_line (20261020090000),
// beat_marks (20261023235900) and end_beat_number (20261028120000).
// beat_number has always been a column.
const UPLOAD_EXTRAS = Object.freeze(['start_line', 'beat_marks', 'end_beat_number']);

/**
 * Keeps an uploaded take's start_line, beat_marks and end_beat_number (extras: readFields
 * output), each in its own UPDATE so a column that is not there yet costs
 * only that field. Never throws: the clip is already saved, so a field the
 * database can't keep is reported, not a failed upload. Returns { row,
 * stored, notStored } (row: the clip as updated, or null when nothing was).
 */
async function storeTakeExtras(sequelize, episodeId, clipId, extras = {}) {
  const stored = [];
  const notStored = [];
  let row = null;
  for (const key of UPLOAD_EXTRAS) {
    if (extras[key] === undefined) continue;
    try {
      const next = await updateClip(sequelize, episodeId, clipId, { [key]: extras[key] });
      if (next) { row = next; stored.push(key); } else notStored.push(key);
    } catch (err) {
      if (err?.status !== 409) console.error(`[rawClips] ${key} not kept with the upload:`, err.message);
      notStored.push(key);
    }
  }
  return { row, stored, notStored };
}

/**
 * The take's length the browser measured (seconds, a multipart field), for a
 * file ffprobe can't time (a browser's WebM has no duration in its header).
 * A number above 0 and at most 36000 (ten hours), to two decimals; anything
 * else is left out (null).
 */
function readTakeSeconds(value) {
  if (value === undefined || value === null || value === '') return null;
  const s = Number(value);
  if (!Number.isFinite(s) || s <= 0 || s > MAX_MARK_SECONDS) {
    console.warn('[rawClips] take seconds left out (not 0 < s <= 36000):', String(value).slice(0, 40));
    return null;
  }
  return Math.round(s * 100) / 100;
}

/**
 * The video's width or height the browser measured (a multipart or JSON
 * field), used when ffprobe can't read the file: a whole number of pixels
 * from 1 to 16384; anything else is left out (null, logged).
 */
function readVideoSize(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 16384) {
    console.warn('[rawClips] video width/height left out (not a whole number from 1 to 16384):', String(value).slice(0, 40));
    return null;
  }
  return n;
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
  return shapeRow((rows || [])[0]) || null;
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

/**
 * ffmpeg input options for a link (http/https), none for a file: reconnect
 * from the byte reached when a read breaks, and a 30-second read timeout so
 * a stalled link fails instead of waiting for the job's kill. Only options
 * ffmpeg has had for years (an older ffmpeg refuses one it doesn't know).
 */
function netInputArgs(input) {
  if (!/^https?:\/\//i.test(String(input))) return [];
  return ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-rw_timeout', '30000000'];
}

// Room green removal needs on the temp disk (P0; Evoni, 2026-10-30): the
// cut-out it writes, at most KEY_MB_PER_SECOND for each second of the clip
// (VP9 with alpha at 1920 is well under that), never under KEY_MIN_BYTES,
// plus KEY_MARGIN_BYTES left free for uploads and the rest of the server.
// The original is read from storage, not copied here.
const MB = 1024 * 1024;
const KEY_MB_PER_SECOND = 1.2;
const KEY_MIN_BYTES = 200 * MB;
const KEY_MARGIN_BYTES = 500 * MB;
const KEY_UNKNOWN_SECONDS = 600; // a clip whose length was never read: assume ten minutes

/** Bytes green removal needs free for a clip of durationSeconds (null: not known). */
function keyRoomNeeded(durationSeconds) {
  const seconds = Number(durationSeconds) > 0 ? Number(durationSeconds) : KEY_UNKNOWN_SECONDS;
  return Math.max(KEY_MIN_BYTES, Math.ceil(seconds * KEY_MB_PER_SECOND * MB)) + KEY_MARGIN_BYTES;
}

/**
 * The S3 key of one green-removal run's cut-out. Each run writes its own
 * file, so a run that fails, or a re-key, never replaces a cut-out that
 * worked; the clip points at the new one only once it is stored.
 */
function cutoutKeyFor(prefix, now = new Date(), rand = Math.random().toString(36).slice(2, 6)) {
  const stamp = now.toISOString().replace(/[-:.]/g, '');
  return `${prefix}/cutout-${stamp}-${rand}.webm`;
}

/** Thrown when a cut-out is shorter than its original: it is never stored. */
class CutoutIncompleteError extends Error {
  constructor(detail) {
    super(`The cut-out came out incomplete (${detail})`);
    this.code = 'CUTOUT_INCOMPLETE';
  }
}

/**
 * Whether a cut-out of gotSeconds covers an original of expectedSeconds
 * (within half a second, or 1% of a long clip). A length that can't be read
 * is not complete; an original whose length is unknown can't be checked.
 */
function cutoutComplete(gotSeconds, expectedSeconds) {
  if (!(Number(expectedSeconds) > 0)) return true;
  if (!(Number(gotSeconds) > 0)) return false;
  return Number(gotSeconds) >= Number(expectedSeconds) - Math.max(0.5, Number(expectedSeconds) * 0.01);
}

// The cut-out's frame rate cap: a 60 fps phone clip is keyed at 30, half the
// work (Evoni, 2026-10-31: 4481.mp4 ran past the time limit).
const KEY_MAX_FPS = 30;

/**
 * ffmpeg arguments: input → WebM (VP9 with alpha, Opus audio), green keyed
 * out, longest side at most 1920, at most KEY_MAX_FPS frames a second when
 * sourceFps says the original has more.
 *
 * VP9 runs at its realtime speed (cpu-used 8) with crf 30: measured
 * 2026-10-31 on a 4K test clip with 2 threads, about 1.7x the frames per
 * second of the earlier good/cpu-used 4/crf 32, SSIM 0.997 against its
 * output, alpha kept. The files are about 1.9x larger.
 */
function chromakeyArgs(input, output, { color = DEFAULT_KEY_COLOR, strength = 'medium', sourceFps = null } = {}) {
  const similarity = STRENGTH_SIMILARITY[strength] ?? STRENGTH_SIMILARITY.medium;
  const filter = [
    "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'",
    ...(Number(sourceFps) > KEY_MAX_FPS + 0.5 ? [`fps=${KEY_MAX_FPS}`] : []),
    `chromakey=color=${color}:similarity=${similarity}:blend=0.08`,
    'despill=type=green',
    'format=yuva420p',
  ].join(',');
  return [
    '-hide_banner', '-y', ...netInputArgs(input), '-i', input,
    '-vf', filter,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30',
    '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-threads', '2', '-auto-alt-ref', '0',
    '-c:a', 'libopus', '-b:a', '128k',
    output,
  ];
}

/**
 * Green removal's progress (Evoni, 2026-10-30: "no way of knowing how long
 * it will take"). ffmpeg writes key=value lines to stdout with -progress
 * pipe:1; out_time_us (out_time_ms in older builds, also microseconds) is how
 * far into the clip it has got. Returns the seconds done, or null for any
 * other line.
 */
function progressSeconds(line) {
  const m = /^out_time_(?:us|ms)=(\d+)\s*$/.exec(String(line || ''));
  return m ? Number(m[1]) / 1e6 : null;
}

/**
 * What the Files page shows for a running green removal:
 * { percent, elapsed_seconds, eta_seconds }. percent is null until ffmpeg
 * has reported and the clip's length is known; it stops at 99 until the
 * cut-out is checked and stored. The time left is the pace so far carried
 * forward, offered only once there is a pace to go on (2% and 30 s in).
 */
function progressView({ startedAt, doneSeconds = null, totalSeconds = null } = {}, now = Date.now()) {
  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));
  const fraction = doneSeconds != null && Number(doneSeconds) >= 0 && Number(totalSeconds) > 0
    ? Math.min(0.99, Number(doneSeconds) / Number(totalSeconds)) : null;
  const eta = fraction != null && fraction >= 0.02 && elapsed >= 30
    ? Math.round((elapsed * (1 - fraction)) / fraction) : null;
  return { percent: fraction == null ? null : Math.floor(fraction * 100), elapsed_seconds: elapsed, eta_seconds: eta };
}

/** ffmpeg arguments: one frame at `at` seconds, size x size, raw rgb24 to stdout (for pickKeyColor). */
function sampleFrameArgs(input, at = 1, size = 16) {
  return ['-hide_banner', ...netInputArgs(input), '-ss', String(at), '-i', input, '-frames:v', '1', '-vf', `scale=${size}:${size}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'];
}

/** ffmpeg arguments: a 480px-wide JPEG thumbnail at `at` seconds. */
function thumbnailArgs(input, output, at = 1) {
  return ['-hide_banner', '-y', '-ss', String(at), '-i', input, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', output];
}

/**
 * ffprobe arguments: the format and streams as JSON. A link (http/https)
 * also gets a 15-second read timeout, so a stalled connection fails
 * instead of waiting for the kill.
 */
function probeArgs(input) {
  const net = /^https?:\/\//i.test(String(input)) ? ['-rw_timeout', '15000000'] : [];
  return ['-v', 'error', ...net, '-print_format', 'json', '-show_format', '-show_streams', input];
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
  // A fragmented MP4 or a browser's WebM can say "N/A" or 0: no length, not 0:00.
  const duration = Number(data?.format?.duration ?? video?.duration);
  const width = Number(video?.width);
  const height = Number(video?.height);
  return {
    duration_seconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 100) / 100 : null,
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
    hasVideo: Boolean(video),
  };
}

/**
 * The video's frame rate from ffprobe's JSON output (avg_frame_rate, else
 * r_frame_rate, as "60000/1001" or "30"), or null when it can't be read.
 */
function readFrameRate(json) {
  let data = json;
  if (typeof json === 'string') {
    try { data = JSON.parse(json); } catch (err) {
      console.error('[rawClips] ffprobe output is not JSON:', err.message);
      return null;
    }
  }
  const video = (Array.isArray(data?.streams) ? data.streams : []).find((s) => s.codec_type === 'video');
  for (const rate of [video?.avg_frame_rate, video?.r_frame_rate]) {
    const [num, den = '1'] = String(rate ?? '').split('/');
    const fps = Number(num) / Number(den);
    if (Number.isFinite(fps) && fps > 0) return Math.round(fps * 100) / 100;
  }
  return null;
}

module.exports = {
  PERFORMERS, KEY_STATUSES, KEY_STRENGTHS, STALE_HOURS, STALE_MESSAGE, DEFAULT_KEY_COLOR, STRENGTH_SIMILARITY,
  TAKE_FIELDS, TAKE_FIELDS_MISSING, BEAT_MARKS_MISSING, END_BEAT_MISSING, MAX_BEAT_MARKS, MAX_MARK_SECONDS,
  UPLOAD_EXTRAS, RawClipError, readFields, readBeatMarks, readStrength, readTakeSeconds, readVideoSize, truthy, findEpisode, shapeRow,
  listClips, getClip, createClip, updateClip, storeTakeExtras, setKeyState, removeClip,
  KEY_MB_PER_SECOND, KEY_MIN_BYTES, KEY_MARGIN_BYTES, KEY_UNKNOWN_SECONDS, keyRoomNeeded, cutoutKeyFor, netInputArgs, CutoutIncompleteError, cutoutComplete,
  KEY_MAX_FPS, pickKeyColor, chromakeyArgs, progressSeconds, progressView, sampleFrameArgs, thumbnailArgs, probeArgs, readProbe, readFrameRate,
};
