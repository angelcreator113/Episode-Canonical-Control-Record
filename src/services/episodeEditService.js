'use strict';

/**
 * Timeline C1 (Evoni, 2026-10-28; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 6, R4.3 C1,
 * R5.1, R5.3, R5.6): the service under the episode's edit. Raw SQL, like
 * voiceStudioService. Server-side only in C1: no page uses it yet, and the
 * legacy Timeline Editor (timeline_data, scenes.duration_seconds) is never
 * read or written here; nor is the reusable scene_angles.video_duration.
 *
 * The rules it keeps:
 * - Every write sends the edit_revision it read. The write holds
 *   episode_edit_state FOR UPDATE; a different revision is a 409 with the
 *   current one, nothing written; a success adds one. Never merged silently.
 * - Every row is checked against the episode it is written for (R5.3): a
 *   scene angle's scene set must be linked to the episode; a raw clip must be
 *   this episode's, Prime's (justawoman) for a segment and Lala's or a
 *   guest's for a scene clip; ranges sit inside the source's measured length.
 * - A video scene clip's length is measured by the server (ffprobe on its
 *   URL, 20 s, before the edit is locked), never scene_angles.video_duration
 *   (a requested generation length). A failed probe refuses the placement.
 * - Prime's picture and commentary are one take on one clock (R2.2): moving
 *   moves both; trimming the video clamps the commentary inside it (never
 *   shifts it); trimming the commentary stays inside the video; a split cuts
 *   both at one source time; replacing the take supersedes the segment (kept).
 * - Visibility rules hide or show the picture only; nothing here mutes on
 *   hiding (R5.1).
 * - Versions are immutable snapshots; restore writes them back as a new live
 *   revision and never edits a version.
 *
 * Times are integer milliseconds; edit_revision and script_seq are BIGINTs,
 * read as text and compared as decimal strings.
 */

const crypto = require('crypto');
const tl = require('../utils/editTimeline');
const { scriptRevision } = require('../utils/scriptRevision');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CLIP_MS = 30 * 60 * 1000;
const PROBE_TIMEOUT_MS = 20 * 1000;
const ANCHOR_KINDS = ['beat_start', 'line_start', 'item_start'];
const ITEM_KINDS = ['object_keyframe', 'camera_keyframe', 'object_visibility', 'angle_change', 'transition', 'audio_offset', 'caption_override'];
const SCENE_PERFORMERS = ['lala', 'guest'];
const PRIME = 'justawoman';

class EditError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const fail = (status, code, message, extra) => { throw new EditError(status, code, message, extra); };
const checkId = (id, what) => { if (!UUID_RE.test(String(id || ''))) fail(404, 'NOT_FOUND', `${what} not found`); };

const q = (sequelize, sql, replacements, t) => sequelize.query(sql, { replacements, transaction: t });
const rows = async (sequelize, sql, replacements, t) => (await q(sequelize, sql, replacements, t))[0];
const one = async (sequelize, sql, replacements, t) => (await rows(sequelize, sql, replacements, t))[0] || null;

// ── Media (ffprobe on a URL), replaceable in tests ───────────────────────────

function defaultMedia() {
  const media = require('./rawClipMedia');
  const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
  return {
    async probeUrl(url) {
      const { stdout } = await media.run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', url], { timeoutMs: PROBE_TIMEOUT_MS });
      return readVideoProbe(stdout.toString());
    },
  };
}
let mediaImpl = null;
const media = () => (mediaImpl ||= defaultMedia());
/** For tests: replace probeUrl. */
function setMedia(m) { mediaImpl = m; }

/** { hasVideo, duration_ms } from ffprobe's JSON. */
function readVideoProbe(json) {
  let data = json;
  if (typeof json === 'string') {
    try { data = JSON.parse(json); } catch (err) {
      console.error('[episodeEdit] ffprobe output is not JSON:', err.message);
      return { hasVideo: false, duration_ms: null };
    }
  }
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  const video = streams.find((s) => s.codec_type === 'video');
  const seconds = Number(data?.format?.duration ?? video?.duration);
  return { hasVideo: Boolean(video), duration_ms: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null };
}

// ── Values from a request ─────────────────────────────────────────────────────

const int = (v, what, { min = 0, max = MAX_CLIP_MS, optional = false } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    fail(400, 'BAD_VALUE', `${what} is needed`);
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, 'BAD_VALUE', `${what} must be a whole number of milliseconds from ${min} to ${max}`);
  return n;
};
const beatOf = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 14) fail(400, 'BAD_BEAT', 'Beats are 1 to 14');
  return n;
};
const gainOf = (v) => {
  const n = Number(v);
  if (!(Number.isFinite(n) && n >= -24 && n <= 12) || Math.abs(Math.round(n * 10) - n * 10) > 1e-9) fail(400, 'BAD_GAIN', 'Gain is −24 to +12 dB, in tenths');
  return n;
};
const fadeOf = (v, what) => int(v, what, { max: 2000 });

/** An anchor from a request: { anchor_kind, anchor_beat, anchor_ref, offset_ms }. */
function anchorOf(body, prefix = '') {
  const kind = body[`${prefix}anchor_kind`];
  if (!ANCHOR_KINDS.includes(kind)) fail(400, 'BAD_ANCHOR', `An anchor is one of ${ANCHOR_KINDS.join(', ')}`);
  const offset = Number(body[`${prefix}offset_ms`] ?? 0);
  if (!Number.isInteger(offset) || Math.abs(offset) > MAX_CLIP_MS * 4) fail(400, 'BAD_ANCHOR', 'The offset is a whole number of milliseconds');
  if (kind === 'beat_start') return { anchor_kind: kind, anchor_beat: beatOf(body[`${prefix}anchor_beat`]), anchor_ref: null, offset_ms: offset };
  const ref = body[`${prefix}anchor_ref`];
  if (!UUID_RE.test(String(ref || ''))) fail(400, 'BAD_ANCHOR', 'A line or item anchor names its line or item');
  return { anchor_kind: kind, anchor_beat: null, anchor_ref: String(ref), offset_ms: offset };
}

/** A layout override: { x, y, w, h } in 1920x1080 pixels (w, h > 0), or null. */
function layoutOf(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) fail(400, 'BAD_LAYOUT', 'A layout is { x, y, w, h }');
  const out = {};
  for (const k of ['x', 'y', 'w', 'h']) {
    if (v[k] === undefined) continue;
    const n = Number(v[k]);
    if (!Number.isFinite(n) || n < -tl.FRAME_W || n > tl.FRAME_W * 2) fail(400, 'BAD_LAYOUT', `${k} is out of range`);
    if ((k === 'w' || k === 'h') && n <= 0) fail(400, 'BAD_LAYOUT', `${k} must be more than 0`);
    out[k] = Math.round(n);
  }
  return out;
}

/** The edit_revision a write sends (a decimal string or a whole number). */
function revisionOf(v) {
  if (v === undefined || v === null || v === '') fail(409, 'EDIT_REVISION_REQUIRED', 'This page is out of date. Reload the edit, then try again.');
  const s = String(v);
  if (!/^[0-9]{1,19}$/.test(s)) fail(400, 'BAD_REVISION', 'edit_revision is a whole number');
  return BigInt(s).toString();
}

// ── The episode and the live edit ─────────────────────────────────────────────

async function episodeRow(sequelize, episodeId, t) {
  checkId(episodeId, 'Episode');
  const ep = await one(sequelize, `SELECT id, script_content, script_line_keys, script_seq::text AS script_seq, deleted_at
    FROM episodes WHERE id = :episodeId`, { episodeId }, t);
  if (!ep || ep.deleted_at) fail(404, 'NOT_FOUND', 'Episode not found');
  return ep;
}

async function currentRevision(sequelize, episodeId, t) {
  const s = await one(sequelize, 'SELECT edit_revision::text AS r FROM episode_edit_state WHERE episode_id = :episodeId', { episodeId }, t);
  return s ? s.r : '0';
}

/**
 * One write to the live edit: the episode checked, the edit state locked
 * FOR UPDATE, the sent revision compared, `fn` run, the revision advanced.
 * Returns fn's result with edit_revision (the new one).
 */
async function withEdit(sequelize, { episodeId, editRevision, userId }, fn) {
  if (!userId) fail(401, 'AUTH_REQUIRED', 'Sign in to edit');
  const expected = revisionOf(editRevision);
  return sequelize.transaction(async (t) => {
    await episodeRow(sequelize, episodeId, t);
    await q(sequelize, 'INSERT INTO episode_edit_state (episode_id) VALUES (:episodeId) ON CONFLICT (episode_id) DO NOTHING', { episodeId }, t);
    const state = await one(sequelize, 'SELECT edit_revision::text AS r FROM episode_edit_state WHERE episode_id = :episodeId FOR UPDATE', { episodeId }, t);
    if (state.r !== expected) {
      fail(409, 'EDIT_CHANGED', 'The edit changed since this page read it. Nothing was saved. Reload and try again.', { current_revision: state.r });
    }
    const result = (await fn(t)) || {};
    const [next] = await rows(sequelize, `UPDATE episode_edit_state SET edit_revision = edit_revision + 1, updated_by = :userId, updated_at = NOW()
      WHERE episode_id = :episodeId RETURNING edit_revision::text AS r`, { episodeId, userId: String(userId).slice(0, 255) }, t);
    return { ...result, edit_revision: next.r };
  });
}

// The live rows of each table, as the edit and the snapshot hold them (no timestamps).
const LIVE = {
  beat_production: {
    table: 'episode_beat_production', where: 'deleted_at IS NULL',
    cols: ['id', 'beat_number', 'prime_mode', 'note', 'set_by', 'set_at'],
  },
  scene_clips: {
    table: 'episode_scene_clips', where: 'deleted_at IS NULL',
    cols: ['id', 'beat_number', 'position', 'source_kind', 'source_id', 'source_in_ms', 'source_out_ms', 'source_duration_ms', 'duration_ms', 'created_by'],
  },
  segments: {
    table: 'episode_prime_segments', where: 'deleted_at IS NULL AND superseded_at IS NULL',
    cols: ['id', 'raw_clip_id', 'source_in_ms', 'source_out_ms', 'anchor_kind', 'anchor_beat', 'anchor_ref', 'offset_ms', 'layout',
      'audio_in_ms', 'audio_out_ms', 'audio_gain_db', 'audio_muted', 'audio_fade_in_ms', 'audio_fade_out_ms', 'status', 'created_by'],
  },
  pip: {
    table: 'episode_pip_settings', where: 'deleted_at IS NULL',
    cols: ['id', 'default_layout', 'default_visible', 'use_cutout'],
  },
  visibility: {
    table: 'episode_pip_visibility', where: 'deleted_at IS NULL',
    cols: ['id', 'scope', 'beat_number', 'anchor_kind', 'anchor_beat', 'anchor_ref', 'offset_ms', 'end_anchor_kind', 'end_anchor_beat', 'end_anchor_ref', 'end_offset_ms', 'visible', 'set_by'],
  },
  items: {
    table: 'timeline_items', where: 'deleted_at IS NULL',
    cols: ['id', 'scene_clip_id', 'kind', 'target_id', 'view', 'anchor_kind', 'anchor_beat', 'anchor_ref', 'offset_ms', 'values', 'origin', 'approval', 'proposal_id', 'created_by'],
  },
  audio_items: {
    table: 'timeline_audio_items', where: 'deleted_at IS NULL',
    cols: ['id', 'track', 'asset_ref', 'slot', 'source_in_ms', 'source_out_ms', 'anchor_kind', 'anchor_beat', 'anchor_ref', 'offset_ms', 'gain_db', 'fade_in_ms', 'fade_out_ms', 'duck_under_dialogue_db', 'created_by'],
  },
};
const quoted = (c) => (c === 'values' ? '"values"' : c);
// A row as JSON-stable values: numbers as numbers, timestamps as ISO text.
const plain = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));

/** Every live row, per table, ordered (the order rules apply in: created, then id). */
async function liveRows(sequelize, episodeId, t) {
  const out = {};
  for (const [key, spec] of Object.entries(LIVE)) {
    const cols = spec.cols.map((c) => {
      if (['audio_gain_db', 'gain_db', 'duck_under_dialogue_db'].includes(c)) return `${c}::float8 AS ${c}`;
      return quoted(c);
    }).join(', ');
    out[key] = (await rows(sequelize, `SELECT ${cols} FROM ${spec.table} WHERE episode_id = :episodeId AND ${spec.where} ORDER BY created_at, id`, { episodeId }, t)).map(plain);
  }
  return out;
}

/** The pure edit (editTimeline's shape) from the live rows. */
function editFrom(live) {
  const beatModes = {};
  for (const b of live.beat_production) beatModes[b.beat_number] = b.prime_mode;
  return {
    fps: 30,
    beatModes,
    sceneClips: live.scene_clips,
    segments: live.segments,
    pip: live.pip[0] || null,
    visibility: live.visibility,
    items: live.items,
    audioItems: live.audio_items,
    lineTimes: {},
    dialogue: [],
  };
}

/** The live edit: { edit_revision, rows, edit }. */
async function loadEdit(sequelize, { episodeId }, t = null) {
  await episodeRow(sequelize, episodeId, t);
  const live = await liveRows(sequelize, episodeId, t);
  return { edit_revision: await currentRevision(sequelize, episodeId, t), rows: live, edit: editFrom(live) };
}

// ── Beat production ──────────────────────────────────────────────────────────

/** Prime required (the default) or gameplay_only for one beat. The previous setting is kept, soft-deleted. */
async function setBeatMode(sequelize, { episodeId, editRevision, userId, beatNumber, primeMode, note = null }) {
  const beat = beatOf(beatNumber);
  if (!['required', 'gameplay_only'].includes(primeMode)) fail(400, 'BAD_MODE', 'A beat is "required" or "gameplay_only"');
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    await q(sequelize, `UPDATE episode_beat_production SET deleted_at = NOW(), updated_at = NOW()
      WHERE episode_id = :episodeId AND beat_number = :beat AND deleted_at IS NULL`, { episodeId, beat }, t);
    const [row] = await rows(sequelize, `INSERT INTO episode_beat_production (episode_id, beat_number, prime_mode, note, set_by)
      VALUES (:episodeId, :beat, :primeMode, :note, :userId) RETURNING id`, { episodeId, beat, primeMode, note: note ? String(note).slice(0, 2000) : null, userId }, t);
    return { beat_production_id: row.id };
  });
}

// ── Scene clips ──────────────────────────────────────────────────────────────

/** An angle video measured before the edit is locked (the probe can take up to 20 s): { url, duration_ms }. */
async function probeAngleVideo(sequelize, sourceId) {
  checkId(sourceId, 'Scene source');
  const a = await one(sequelize, 'SELECT video_clip_url, deleted_at FROM scene_angles WHERE id = :sourceId', { sourceId });
  if (!a || a.deleted_at) fail(404, 'NOT_FOUND', 'Scene angle not found');
  if (!a.video_clip_url) fail(409, 'NO_VIDEO', 'This angle has no video clip');
  let probe;
  try {
    probe = await media().probeUrl(a.video_clip_url);
  } catch (err) {
    console.error('[episodeEdit] ffprobe could not read the angle video:', err.message);
    fail(422, 'PROBE_FAILED', 'The video could not be measured, so it was not placed. Try again, or check the clip.');
  }
  if (!probe || !probe.hasVideo || !probe.duration_ms) fail(422, 'PROBE_FAILED', 'The video could not be measured, so it was not placed.');
  return { url: a.video_clip_url, duration_ms: probe.duration_ms };
}

/**
 * A scene source checked for this episode, in the write's transaction:
 * { source_duration_ms } (null for a still). An angle video uses the
 * measurement taken before the lock, refused if its URL changed since.
 */
async function sceneSource(sequelize, episodeId, kind, sourceId, t, probed = null) {
  checkId(sourceId, 'Scene source');
  if (kind === 'angle_still' || kind === 'angle_video') {
    const a = await one(sequelize, `SELECT a.id, a.still_image_url, a.video_clip_url, a.deleted_at, s.deleted_at AS set_deleted_at,
        EXISTS (SELECT 1 FROM scene_set_episodes l WHERE l.scene_set_id = a.scene_set_id AND l.episode_id = :episodeId AND l.deleted_at IS NULL) AS linked
      FROM scene_angles a JOIN scene_sets s ON s.id = a.scene_set_id WHERE a.id = :sourceId`, { episodeId, sourceId }, t);
    if (!a || a.deleted_at || a.set_deleted_at) fail(404, 'NOT_FOUND', 'Scene angle not found');
    if (!a.linked) fail(409, 'ANGLE_NOT_LINKED', "This angle's scene set is not linked to this episode");
    if (kind === 'angle_still') {
      if (!a.still_image_url) fail(409, 'NO_STILL', 'This angle has no still image');
      return { source_duration_ms: null };
    }
    if (!a.video_clip_url) fail(409, 'NO_VIDEO', 'This angle has no video clip');
    if (!probed || probed.url !== a.video_clip_url) fail(409, 'SOURCE_CHANGED', 'The video changed while it was measured. Try again.');
    return { source_duration_ms: probed.duration_ms };
  }
  if (kind === 'raw_clip') {
    const c = await one(sequelize, `SELECT id, episode_id, performer, duration_seconds::float8 AS duration_seconds, deleted_at
      FROM episode_raw_clips WHERE id = :sourceId`, { sourceId }, t);
    if (!c || c.deleted_at || c.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Take not found');
    if (!SCENE_PERFORMERS.includes(c.performer)) fail(409, 'WRONG_PERFORMER', "A scene clip is Lala's or a guest's take; Prime's takes are segments");
    if (!(c.duration_seconds > 0)) fail(409, 'NO_DURATION', 'This take has no measured length yet');
    return { source_duration_ms: Math.round(c.duration_seconds * 1000) };
  }
  return fail(400, 'BAD_KIND', 'A scene clip is an angle_still, an angle_video or a raw_clip');
}

function sceneRange(kind, sourceDuration, body, base = null) {
  if (kind === 'angle_still') {
    if (body.source_in_ms != null || body.source_out_ms != null) fail(400, 'BAD_RANGE', 'A still has no in or out point');
    return { source_in_ms: null, source_out_ms: null };
  }
  const sin = int(body.source_in_ms ?? (base ? base.source_in_ms : 0), 'source_in_ms');
  const sout = int(body.source_out_ms ?? (base ? base.source_out_ms : sourceDuration), 'source_out_ms');
  if (!(sin < sout && sout <= sourceDuration)) fail(400, 'BAD_RANGE', `In and out must be within the source (0–${sourceDuration} ms), with in before out`);
  return { source_in_ms: sin, source_out_ms: sout };
}

/** Places a scene clip in a beat (at the end of the beat unless a position is given). */
async function placeSceneClip(sequelize, { episodeId, editRevision, userId, body }) {
  const beat = beatOf(body.beat_number);
  const kind = body.source_kind;
  // Measured first, outside the edit's lock; checked again inside it.
  const probed = kind === 'angle_video' ? await probeAngleVideo(sequelize, body.source_id) : null;
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const { source_duration_ms: sourceDuration } = await sceneSource(sequelize, episodeId, kind, body.source_id, t, probed);
    const range = sceneRange(kind, sourceDuration, body);
    const duration = int(body.duration_ms ?? (kind === 'angle_still' ? undefined : range.source_out_ms - range.source_in_ms), 'duration_ms', { min: 1 });
    let position = body.position == null ? null : int(body.position, 'position', { max: 10000 });
    if (position == null) {
      const last = await one(sequelize, `SELECT COALESCE(max(position) + 1, 0) AS p FROM episode_scene_clips
        WHERE episode_id = :episodeId AND beat_number = :beat AND deleted_at IS NULL`, { episodeId, beat }, t);
      position = Number(last.p);
    }
    const taken = await one(sequelize, `SELECT id FROM episode_scene_clips WHERE episode_id = :episodeId AND beat_number = :beat AND position = :position AND deleted_at IS NULL`,
      { episodeId, beat, position }, t);
    if (taken) fail(409, 'POSITION_TAKEN', 'That place in the beat already has a clip');
    const [row] = await rows(sequelize, `INSERT INTO episode_scene_clips
      (episode_id, beat_number, position, source_kind, source_id, source_in_ms, source_out_ms, source_duration_ms, duration_ms, created_by)
      VALUES (:episodeId, :beat, :position, :kind, :sourceId, :sin, :sout, :sdur, :duration, :userId) RETURNING id`, {
      episodeId, beat, position, kind, sourceId: body.source_id, sin: range.source_in_ms, sout: range.source_out_ms,
      sdur: sourceDuration, duration, userId,
    }, t);
    return { scene_clip_id: row.id, source_duration_ms: sourceDuration };
  });
}

async function sceneClipRow(sequelize, episodeId, clipId, t) {
  checkId(clipId, 'Scene clip');
  const c = await one(sequelize, `SELECT * FROM episode_scene_clips WHERE id = :clipId FOR UPDATE`, { clipId }, t);
  if (!c || c.deleted_at || c.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Scene clip not found');
  return c;
}

/** Trims a scene clip, or sets its episode-specific duration or position. The source is never touched. */
async function updateSceneClip(sequelize, { episodeId, editRevision, userId, clipId, body }) {
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const c = await sceneClipRow(sequelize, episodeId, clipId, t);
    const range = sceneRange(c.source_kind, c.source_duration_ms, body, c);
    const duration = int(body.duration_ms ?? c.duration_ms, 'duration_ms', { min: 1 });
    const position = body.position == null ? c.position : int(body.position, 'position', { max: 10000 });
    if (position !== c.position) {
      const taken = await one(sequelize, `SELECT id FROM episode_scene_clips WHERE episode_id = :episodeId AND beat_number = :beat AND position = :position AND deleted_at IS NULL AND id <> :clipId`,
        { episodeId, beat: c.beat_number, position, clipId }, t);
      if (taken) fail(409, 'POSITION_TAKEN', 'That place in the beat already has a clip');
    }
    await q(sequelize, `UPDATE episode_scene_clips SET source_in_ms = :sin, source_out_ms = :sout, duration_ms = :duration, position = :position, updated_at = NOW()
      WHERE id = :clipId`, { sin: range.source_in_ms, sout: range.source_out_ms, duration, position, clipId }, t);
    return { scene_clip_id: clipId };
  });
}

// ── Prime segments (one take, one clock) ─────────────────────────────────────

/** Prime's take, checked for this episode: its measured length in ms. */
async function primeClip(sequelize, episodeId, rawClipId, t) {
  checkId(rawClipId, 'Take');
  const c = await one(sequelize, `SELECT id, episode_id, performer, duration_seconds::float8 AS duration_seconds, deleted_at
    FROM episode_raw_clips WHERE id = :rawClipId FOR SHARE`, { rawClipId }, t);
  if (!c || c.deleted_at || c.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Take not found');
  if (c.performer !== PRIME) fail(409, 'WRONG_PERFORMER', "A Prime segment is Prime's own take");
  if (!(c.duration_seconds > 0)) fail(409, 'NO_DURATION', 'This take has no measured length yet');
  return Math.round(c.duration_seconds * 1000);
}

/** The anchor's target, checked: a line association or a timeline item of this episode. */
async function checkAnchorTarget(sequelize, episodeId, a, t) {
  if (a.anchor_kind === 'item_start') {
    const item = await one(sequelize, 'SELECT id FROM timeline_items WHERE id = :id AND episode_id = :episodeId AND deleted_at IS NULL', { id: a.anchor_ref, episodeId }, t);
    if (!item) fail(404, 'NOT_FOUND', 'The anchored item is not in this edit');
  } else if (a.anchor_kind === 'line_start') {
    const line = await one(sequelize, `SELECT id FROM line_voice_associations WHERE id = :id AND episode_id = :episodeId AND superseded_at IS NULL AND deleted_at IS NULL`,
      { id: a.anchor_ref, episodeId }, t);
    if (!line) fail(404, 'NOT_FOUND', 'The anchored line is not tied in this episode');
  }
}

function audioSettings(body, base = {}) {
  const gain = body.audio_gain_db === undefined ? Number(base.audio_gain_db ?? 0) : gainOf(body.audio_gain_db);
  const muted = body.audio_muted === undefined ? Boolean(base.audio_muted) : body.audio_muted === true || body.audio_muted === 'true';
  const fin = body.audio_fade_in_ms === undefined ? (base.audio_fade_in_ms ?? 0) : fadeOf(body.audio_fade_in_ms, 'audio_fade_in_ms');
  const fout = body.audio_fade_out_ms === undefined ? (base.audio_fade_out_ms ?? 0) : fadeOf(body.audio_fade_out_ms, 'audio_fade_out_ms');
  return { audio_gain_db: gain, audio_muted: muted, audio_fade_in_ms: fin, audio_fade_out_ms: fout };
}

// Fades that no longer fit a shorter commentary are shortened, never moved. Returns the two fades only.
// No commentary (a NULL range) has no fades.
function fitFades(s, ain, aout) {
  if (ain == null || aout == null) return { audio_fade_in_ms: 0, audio_fade_out_ms: 0 };
  const len = aout - ain;
  const fin = Math.min(s.audio_fade_in_ms, len);
  return { audio_fade_in_ms: fin, audio_fade_out_ms: Math.min(s.audio_fade_out_ms, len - fin) };
}

function checkSegmentValues(v) {
  if (!(v.source_in_ms >= 0 && v.source_in_ms < v.source_out_ms)) fail(400, 'BAD_RANGE', 'In must be before out');
  if (v.audio_in_ms == null || v.audio_out_ms == null) {
    // No commentary: nothing to play, so nothing to fade.
    if (v.audio_in_ms != null || v.audio_out_ms != null) fail(400, 'BAD_RANGE', 'The commentary needs both its in and its out');
    if (v.audio_fade_in_ms || v.audio_fade_out_ms) fail(400, 'BAD_FADE', 'This segment has no commentary to fade');
    return;
  }
  if (!(v.source_in_ms <= v.audio_in_ms && v.audio_in_ms < v.audio_out_ms && v.audio_out_ms <= v.source_out_ms)) {
    fail(400, 'COMMENTARY_OUTSIDE_VIDEO', "The commentary must sit inside the video's range");
  }
  if (v.audio_fade_in_ms + v.audio_fade_out_ms > v.audio_out_ms - v.audio_in_ms) fail(400, 'BAD_FADE', 'The fades are longer than the commentary');
}

const SEGMENT_COLS = ['raw_clip_id', 'source_in_ms', 'source_out_ms', 'anchor_kind', 'anchor_beat', 'anchor_ref', 'offset_ms', 'layout',
  'audio_in_ms', 'audio_out_ms', 'audio_gain_db', 'audio_muted', 'audio_fade_in_ms', 'audio_fade_out_ms', 'status'];

async function insertSegment(sequelize, episodeId, v, userId, t) {
  checkSegmentValues(v);
  const values = SEGMENT_COLS.map((c) => (c === 'layout' ? 'CAST(:layout AS jsonb)' : `:${c}`)).join(', ');
  const [row] = await rows(sequelize, `INSERT INTO episode_prime_segments (episode_id, ${SEGMENT_COLS.join(', ')}, created_by)
    VALUES (:episodeId, ${values}, :userId) RETURNING id`, {
    episodeId, ...v, layout: v.layout ? JSON.stringify(v.layout) : null, status: v.status || 'draft', userId,
  }, t);
  return row.id;
}

/** Places a stretch of Prime's take. The commentary defaults to the whole video range. */
async function placeSegment(sequelize, { episodeId, editRevision, userId, body }) {
  const a = anchorOf(body);
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const duration = await primeClip(sequelize, episodeId, body.raw_clip_id, t);
    await checkAnchorTarget(sequelize, episodeId, a, t);
    const sin = int(body.source_in_ms ?? 0, 'source_in_ms');
    const sout = int(body.source_out_ms ?? duration, 'source_out_ms');
    if (sout > duration) fail(400, 'BAD_RANGE', `Out must be within the take (0–${duration} ms)`);
    const ain = body.audio_in_ms == null ? sin : int(body.audio_in_ms, 'audio_in_ms');
    const aout = body.audio_out_ms == null ? sout : int(body.audio_out_ms, 'audio_out_ms');
    const v = { raw_clip_id: body.raw_clip_id, source_in_ms: sin, source_out_ms: sout, ...a, layout: layoutOf(body.layout), audio_in_ms: ain, audio_out_ms: aout, ...audioSettings(body) };
    return { segment_id: await insertSegment(sequelize, episodeId, v, userId, t) };
  });
}

async function segmentRow(sequelize, episodeId, segmentId, t) {
  checkId(segmentId, 'Segment');
  const s = await one(sequelize, `SELECT id, episode_id, raw_clip_id, source_in_ms, source_out_ms, anchor_kind, anchor_beat, anchor_ref, offset_ms, layout,
      audio_in_ms, audio_out_ms, audio_gain_db::float8 AS audio_gain_db, audio_muted, audio_fade_in_ms, audio_fade_out_ms, status, superseded_at, deleted_at
    FROM episode_prime_segments WHERE id = :segmentId FOR UPDATE`, { segmentId }, t);
  if (!s || s.deleted_at || s.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Segment not found');
  if (s.superseded_at) fail(409, 'SEGMENT_REPLACED', 'This segment was split or replaced. Reload.');
  return s;
}

async function updateSegment(sequelize, segmentId, v, t) {
  checkSegmentValues(v);
  await q(sequelize, `UPDATE episode_prime_segments SET source_in_ms = :source_in_ms, source_out_ms = :source_out_ms,
      anchor_kind = :anchor_kind, anchor_beat = :anchor_beat, anchor_ref = :anchor_ref, offset_ms = :offset_ms, layout = CAST(:layout AS jsonb),
      audio_in_ms = :audio_in_ms, audio_out_ms = :audio_out_ms, audio_gain_db = :audio_gain_db, audio_muted = :audio_muted,
      audio_fade_in_ms = :audio_fade_in_ms, audio_fade_out_ms = :audio_fade_out_ms, updated_at = NOW()
    WHERE id = :segmentId`, { ...v, layout: v.layout ? JSON.stringify(v.layout) : null, segmentId }, t);
}

/** One edit of a segment: `change(s, t)` returns the new values from the locked row. */
const editSegment = (sequelize, { episodeId, editRevision, userId, segmentId }, change) => withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
  const s = await segmentRow(sequelize, episodeId, segmentId, t);
  const v = await change(s, t);
  await updateSegment(sequelize, segmentId, { ...s, ...v }, t);
  return { segment_id: segmentId };
});

/** Moves a segment: picture and commentary together (one placement). */
const moveSegment = (sequelize, args) => {
  const a = anchorOf(args.body);
  return editSegment(sequelize, args, async (s, t) => {
    await checkAnchorTarget(sequelize, args.episodeId, a, t);
    return a;
  });
};

/**
 * Trims the video. The commentary is clamped inside the new range, never
 * shifted; one that would be left with nothing is refused (trim it first).
 */
const trimSegmentVideo = (sequelize, args) => editSegment(sequelize, args, async (s, t) => {
  const duration = await primeClip(sequelize, args.episodeId, s.raw_clip_id, t);
  const sin = int(args.body.source_in_ms ?? s.source_in_ms, 'source_in_ms');
  const sout = int(args.body.source_out_ms ?? s.source_out_ms, 'source_out_ms');
  if (!(sin < sout && sout <= duration)) fail(400, 'BAD_RANGE', `In and out must be within the take (0–${duration} ms), with in before out`);
  // Non-ripple (Evoni, 2026-10-28): the frames left keep their edit time, so trimming the head moves
  // the start later; nothing else on the timeline moves.
  const offset = Number(s.offset_ms) + (sin - s.source_in_ms);
  if (s.audio_in_ms == null) return { source_in_ms: sin, source_out_ms: sout, offset_ms: offset };
  const ain = Math.max(s.audio_in_ms, sin);
  const aout = Math.min(s.audio_out_ms, sout);
  // Never a silent mute (Evoni, 2026-10-28): a trim that would leave no commentary is refused.
  if (ain >= aout) fail(409, 'COMMENTARY_OUTSIDE_TRIM', 'The commentary would be cut away entirely. Trim or move the commentary first.');
  return { source_in_ms: sin, source_out_ms: sout, offset_ms: offset, audio_in_ms: ain, audio_out_ms: aout, ...fitFades(s, ain, aout) };
});

/** Trims the commentary, inside the video's range (on a segment with none, this sets one explicitly). */
const trimSegmentAudio = (sequelize, args) => editSegment(sequelize, args, async (s) => {
  const ain = int(args.body.audio_in_ms ?? s.audio_in_ms, 'audio_in_ms');
  const aout = int(args.body.audio_out_ms ?? s.audio_out_ms, 'audio_out_ms');
  return { audio_in_ms: ain, audio_out_ms: aout, ...fitFades(s, ain, aout) };
});

/** The commentary's gain, mute and fades. Muting never hides the picture. */
const setSegmentAudio = (sequelize, args) => editSegment(sequelize, args, async (s) => audioSettings(args.body, s));

/** The segment's own layout (null: the episode's default). */
const setSegmentLayout = (sequelize, args) => editSegment(sequelize, args, async () => ({ layout: layoutOf(args.body.layout) }));

/**
 * Splits a segment at one source time: both halves keep the take's clock (the
 * second is placed where that source time already played). The commentary is
 * cut at the same time; a half the commentary was not in has none (a NULL
 * range: no event in the mix, and unmuting it plays nothing). The segment
 * split is kept, superseded.
 */
async function splitSegment(sequelize, { episodeId, editRevision, userId, segmentId, body }) {
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const s = await segmentRow(sequelize, episodeId, segmentId, t);
    const at = int(body.at_source_ms, 'at_source_ms');
    if (!(s.source_in_ms < at && at < s.source_out_ms)) fail(400, 'BAD_SPLIT', 'Split inside the segment');
    const half = (sin, sout, offset, fades) => {
      let ain = s.audio_in_ms == null ? null : Math.max(s.audio_in_ms, sin);
      let aout = s.audio_out_ms == null ? null : Math.min(s.audio_out_ms, sout);
      // A half the commentary was not in has none (NULL): never audible, whatever its mute says.
      if (ain == null || ain >= aout) { ain = null; aout = null; }
      const audio = fitFades({ ...s, ...fades }, ain, aout);
      return { ...s, source_in_ms: sin, source_out_ms: sout, offset_ms: offset, audio_in_ms: ain, audio_out_ms: aout,
        audio_fade_in_ms: audio.audio_fade_in_ms, audio_fade_out_ms: audio.audio_fade_out_ms };
    };
    const first = half(s.source_in_ms, at, Number(s.offset_ms), { audio_fade_out_ms: 0 });
    const second = half(at, s.source_out_ms, Number(s.offset_ms) + (at - s.source_in_ms), { audio_fade_in_ms: 0 });
    await q(sequelize, 'UPDATE episode_prime_segments SET superseded_at = NOW(), updated_at = NOW() WHERE id = :segmentId', { segmentId }, t);
    const a = await insertSegment(sequelize, episodeId, first, userId, t);
    const b = await insertSegment(sequelize, episodeId, second, userId, t);
    await q(sequelize, 'UPDATE episode_prime_segments SET superseded_by = :a WHERE id = :segmentId', { a, segmentId }, t);
    return { segment_ids: [a, b], superseded: segmentId };
  });
}

/** Replaces the take: a new segment in the same place and layout; the old one is kept, superseded. */
async function replaceTake(sequelize, { episodeId, editRevision, userId, segmentId, body }) {
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const s = await segmentRow(sequelize, episodeId, segmentId, t);
    const duration = await primeClip(sequelize, episodeId, body.raw_clip_id, t);
    const sin = int(body.source_in_ms ?? 0, 'source_in_ms');
    const sout = int(body.source_out_ms ?? duration, 'source_out_ms');
    if (!(sin < sout && sout <= duration)) fail(400, 'BAD_RANGE', `In and out must be within the take (0–${duration} ms), with in before out`);
    const v = { ...s, raw_clip_id: body.raw_clip_id, source_in_ms: sin, source_out_ms: sout, audio_in_ms: sin, audio_out_ms: sout, status: 'draft', ...fitFades(s, sin, sout) };
    await q(sequelize, 'UPDATE episode_prime_segments SET superseded_at = NOW(), updated_at = NOW() WHERE id = :segmentId', { segmentId }, t);
    const id = await insertSegment(sequelize, episodeId, v, userId, t);
    await q(sequelize, 'UPDATE episode_prime_segments SET superseded_by = :id WHERE id = :segmentId', { id, segmentId }, t);
    return { segment_id: id, superseded: segmentId };
  });
}

// ── PIP settings and visibility ──────────────────────────────────────────────

/** The episode's PIP defaults: layout, visible, cutout. */
async function setPipSettings(sequelize, { episodeId, editRevision, userId, body }) {
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const cur = await one(sequelize, 'SELECT * FROM episode_pip_settings WHERE episode_id = :episodeId AND deleted_at IS NULL', { episodeId }, t);
    const layout = body.default_layout === undefined ? (cur ? cur.default_layout : null) : layoutOf(body.default_layout);
    const visible = body.default_visible === undefined ? (cur ? cur.default_visible : true) : body.default_visible !== false;
    const cutout = body.use_cutout === undefined ? (cur ? cur.use_cutout : false) : body.use_cutout === true;
    await q(sequelize, `INSERT INTO episode_pip_settings (episode_id, default_layout, default_visible, use_cutout)
      VALUES (:episodeId, CAST(:layout AS jsonb), :visible, :cutout)
      ON CONFLICT (episode_id) DO UPDATE SET default_layout = EXCLUDED.default_layout, default_visible = EXCLUDED.default_visible,
        use_cutout = EXCLUDED.use_cutout, deleted_at = NULL, updated_at = NOW()`, { episodeId, layout: layout ? JSON.stringify(layout) : null, visible, cutout }, t);
    return {};
  });
}

/** A manual rule: hide or show the PIP for a beat or a range. It never mutes the commentary. */
async function addVisibilityRule(sequelize, { episodeId, editRevision, userId, body }) {
  const visible = body.visible === true || body.visible === 'true' ? true : body.visible === false || body.visible === 'false' ? false : fail(400, 'BAD_VALUE', 'visible is true or false');
  let v;
  if (body.scope === 'beat') v = { scope: 'beat', beat_number: beatOf(body.beat_number) };
  else if (body.scope === 'range') {
    const s = anchorOf(body);
    const e = anchorOf(body, 'end_');
    v = { scope: 'range', beat_number: null, ...s, end_anchor_kind: e.anchor_kind, end_anchor_beat: e.anchor_beat, end_anchor_ref: e.anchor_ref, end_offset_ms: e.offset_ms };
  } else fail(400, 'BAD_SCOPE', 'A rule is for a "beat" or a "range"');
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    if (v.scope === 'range') {
      await checkAnchorTarget(sequelize, episodeId, v, t);
      await checkAnchorTarget(sequelize, episodeId, { anchor_kind: v.end_anchor_kind, anchor_ref: v.end_anchor_ref }, t);
    }
    const [row] = await rows(sequelize, `INSERT INTO episode_pip_visibility
      (episode_id, scope, beat_number, anchor_kind, anchor_beat, anchor_ref, offset_ms, end_anchor_kind, end_anchor_beat, end_anchor_ref, end_offset_ms, visible, set_by)
      VALUES (:episodeId, :scope, :beat_number, :anchor_kind, :anchor_beat, :anchor_ref, :offset_ms, :end_anchor_kind, :end_anchor_beat, :end_anchor_ref, :end_offset_ms, :visible, :userId)
      RETURNING id`, {
      episodeId, anchor_kind: null, anchor_beat: null, anchor_ref: null, offset_ms: null,
      end_anchor_kind: null, end_anchor_beat: null, end_anchor_ref: null, end_offset_ms: null, ...v, visible, userId,
    }, t);
    return { rule_id: row.id };
  });
}

// ── Timeline items and audio items ───────────────────────────────────────────

async function addItem(sequelize, { episodeId, editRevision, userId, body }) {
  if (!ITEM_KINDS.includes(body.kind)) fail(400, 'BAD_KIND', `An item is one of ${ITEM_KINDS.join(', ')}`);
  const a = anchorOf(body);
  const values = body.values === undefined ? {} : body.values;
  if (typeof values !== 'object' || values === null || Array.isArray(values)) fail(400, 'BAD_VALUE', 'values is an object');
  if (JSON.stringify(values).length > 20000) fail(400, 'BAD_VALUE', 'values is too large');
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    if (body.scene_clip_id != null) await sceneClipRow(sequelize, episodeId, body.scene_clip_id, t);
    let target = body.target_id == null ? null : String(body.target_id).slice(0, 200);
    if (body.kind === 'audio_offset') {
      // A dialogue nudge targets a line tied in this episode.
      if (!UUID_RE.test(String(target || ''))) fail(400, 'BAD_TARGET', 'A dialogue nudge names its line');
      await checkAnchorTarget(sequelize, episodeId, { anchor_kind: 'line_start', anchor_ref: target }, t);
      target = String(target);
    }
    await checkAnchorTarget(sequelize, episodeId, a, t);
    const [row] = await rows(sequelize, `INSERT INTO timeline_items
      (episode_id, scene_clip_id, kind, target_id, view, anchor_kind, anchor_beat, anchor_ref, offset_ms, "values", origin, approval, created_by)
      VALUES (:episodeId, :sceneClipId, :kind, :target, :view, :anchor_kind, :anchor_beat, :anchor_ref, :offset_ms, CAST(:values AS jsonb), 'user', 'approved', :userId)
      RETURNING id`, {
      episodeId, sceneClipId: body.scene_clip_id ?? null, kind: body.kind, target, view: body.view ? String(body.view).slice(0, 16) : null,
      ...a, values: JSON.stringify(values), userId,
    }, t);
    return { item_id: row.id };
  });
}

async function addAudioItem(sequelize, { episodeId, editRevision, userId, body }) {
  if (!['music', 'sfx'].includes(body.track)) fail(400, 'BAD_TRACK', 'An audio item is "music" or "sfx"');
  if (!body.asset_ref && !body.slot) fail(400, 'BAD_VALUE', 'An audio item names a library file or an SFX slot');
  const a = anchorOf(body);
  const sin = int(body.source_in_ms ?? 0, 'source_in_ms');
  const sout = int(body.source_out_ms, 'source_out_ms');
  if (!(sin < sout)) fail(400, 'BAD_RANGE', 'In must be before out');
  const duck = body.duck_under_dialogue_db == null ? null : Number(body.duck_under_dialogue_db);
  if (duck !== null && !(Number.isFinite(duck) && duck >= -24 && duck <= 0)) fail(400, 'BAD_GAIN', 'Ducking is −24 to 0 dB');
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    await checkAnchorTarget(sequelize, episodeId, a, t);
    const [row] = await rows(sequelize, `INSERT INTO timeline_audio_items
      (episode_id, track, asset_ref, slot, source_in_ms, source_out_ms, anchor_kind, anchor_beat, anchor_ref, offset_ms, gain_db, fade_in_ms, fade_out_ms, duck_under_dialogue_db, created_by)
      VALUES (:episodeId, :track, :assetRef, :slot, :sin, :sout, :anchor_kind, :anchor_beat, :anchor_ref, :offset_ms, :gain, :fin, :fout, :duck, :userId) RETURNING id`, {
      episodeId, track: body.track, assetRef: body.asset_ref ? String(body.asset_ref).slice(0, 500) : null, slot: body.slot ? String(body.slot).slice(0, 100) : null,
      sin, sout, ...a, gain: body.gain_db == null ? 0 : gainOf(body.gain_db),
      fin: fadeOf(body.fade_in_ms ?? 0, 'fade_in_ms'), fout: fadeOf(body.fade_out_ms ?? 0, 'fade_out_ms'), duck, userId,
    }, t);
    return { audio_item_id: row.id };
  });
}

// Removing is a soft delete, in every table.
const REMOVABLE = {
  scene_clip: 'episode_scene_clips', segment: 'episode_prime_segments', visibility: 'episode_pip_visibility', item: 'timeline_items', audio_item: 'timeline_audio_items',
};
async function removeRow(sequelize, { episodeId, editRevision, userId, what, id }) {
  const table = REMOVABLE[what];
  if (!table) fail(400, 'BAD_KIND', 'Nothing of that kind');
  checkId(id, 'Row');
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const r = await one(sequelize, `SELECT id, episode_id, deleted_at FROM ${table} WHERE id = :id FOR UPDATE`, { id }, t);
    if (!r || r.deleted_at || r.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Not found');
    await q(sequelize, `UPDATE ${table} SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id`, { id }, t);
    return { removed: id };
  });
}

// ── Versions (immutable snapshots) ───────────────────────────────────────────

/** JSON with sorted keys, so the same rows always hash the same. */
function stableJson(v) {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`;
  return JSON.stringify(v === undefined ? null : v);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** The live edit's rows, as a version stores them. */
const snapshotOf = (live) => Object.fromEntries(Object.keys(LIVE).map((k) => [k, live[k]]));

/**
 * Saves the live edit as a named version: every live row, the edit revision
 * and the script it was made against. Sent with the edit_revision the page
 * shows, so the version is what was seen (409 otherwise); it changes nothing live.
 */
async function createVersion(sequelize, { episodeId, editRevision, userId, name }) {
  if (!userId) fail(401, 'AUTH_REQUIRED', 'Sign in to save a version');
  const expected = revisionOf(editRevision);
  const label = String(name || '').trim().slice(0, 200);
  if (!label) fail(400, 'BAD_NAME', 'Give the version a name');
  return sequelize.transaction(async (t) => {
    const ep = await episodeRow(sequelize, episodeId, t);
    await q(sequelize, 'INSERT INTO episode_edit_state (episode_id) VALUES (:episodeId) ON CONFLICT (episode_id) DO NOTHING', { episodeId }, t);
    const state = await one(sequelize, 'SELECT edit_revision::text AS r FROM episode_edit_state WHERE episode_id = :episodeId FOR SHARE', { episodeId }, t);
    if (state.r !== expected) fail(409, 'EDIT_CHANGED', 'The edit changed since this page read it. Nothing was saved.', { current_revision: state.r });
    const snapshot = snapshotOf(await liveRows(sequelize, episodeId, t));
    const text = stableJson(snapshot);
    const script = typeof ep.script_content === 'string' ? ep.script_content : '';
    const [row] = await rows(sequelize, `INSERT INTO edit_versions (episode_id, name, snapshot, snapshot_sha256, edit_revision, script_revision, script_seq, created_by)
      VALUES (:episodeId, :label, CAST(:snapshot AS jsonb), :hash, CAST(:rev AS bigint), :scriptRevision, CAST(:seq AS bigint), :userId) RETURNING id`, {
      episodeId, label, snapshot: text, hash: sha256(text), rev: state.r, scriptRevision: scriptRevision(script, ep.script_line_keys ?? null), seq: ep.script_seq, userId,
    }, t);
    return { version_id: row.id, snapshot_sha256: sha256(text), edit_revision: state.r };
  });
}

async function listVersions(sequelize, { episodeId }) {
  await episodeRow(sequelize, episodeId);
  return rows(sequelize, `SELECT id, name, snapshot_sha256, edit_revision::text AS edit_revision, script_revision, script_seq::text AS script_seq, created_by, created_at
    FROM edit_versions WHERE episode_id = :episodeId AND deleted_at IS NULL ORDER BY created_at DESC, id DESC`, { episodeId });
}

async function versionRow(sequelize, episodeId, versionId, t) {
  checkId(versionId, 'Version');
  const v = await one(sequelize, `SELECT id, episode_id, name, snapshot, snapshot_sha256, edit_revision::text AS edit_revision, script_revision, script_seq::text AS script_seq, deleted_at
    FROM edit_versions WHERE id = :versionId`, { versionId }, t);
  if (!v || v.deleted_at || v.episode_id !== episodeId) fail(404, 'NOT_FOUND', 'Version not found');
  if (sha256(stableJson(v.snapshot)) !== v.snapshot_sha256) {
    console.error(`[episodeEdit] version ${versionId} does not match its sha256`);
    fail(500, 'VERSION_DAMAGED', 'This version does not match its checksum, so it was not used.');
  }
  return v;
}

const getVersion = (sequelize, { episodeId, versionId }) => versionRow(sequelize, episodeId, versionId);

/**
 * Restores a version as a new live revision: live rows the version lacks are
 * soft-deleted, the version's rows are written back with their own ids (a row
 * removed or replaced since is live again). The version row is only read.
 */
async function restoreVersion(sequelize, { episodeId, editRevision, userId, versionId }) {
  return withEdit(sequelize, { episodeId, editRevision, userId }, async (t) => {
    const v = await versionRow(sequelize, episodeId, versionId, t);
    for (const [key, spec] of Object.entries(LIVE)) {
      const keep = (v.snapshot[key] || []).map((r) => r.id);
      await q(sequelize, `UPDATE ${spec.table} SET deleted_at = NOW(), updated_at = NOW() WHERE episode_id = :episodeId AND ${spec.where}${keep.length ? ' AND id NOT IN (:keep)' : ''}`,
        { episodeId, keep }, t);
    }
    for (const [key, spec] of Object.entries(LIVE)) {
      for (const r of v.snapshot[key] || []) {
        const cols = spec.cols;
        const jsonCols = ['layout', 'values', 'default_layout'];
        const vals = cols.map((c) => (jsonCols.includes(c) ? `CAST(:${c} AS jsonb)` : `:${c}`)).join(', ');
        const sets = cols.filter((c) => c !== 'id').map((c) => `${quoted(c)} = EXCLUDED.${quoted(c)}`);
        sets.push('deleted_at = NULL', 'updated_at = NOW()');
        if (key === 'segments') sets.push('superseded_at = NULL', 'superseded_by = NULL');
        const repl = { episodeId };
        for (const c of cols) repl[c] = jsonCols.includes(c) ? (r[c] == null ? null : JSON.stringify(r[c])) : (r[c] === undefined ? null : r[c]);
        // The PIP settings are one row per episode, whatever its id.
        const conflict = key === 'pip' ? '(episode_id)' : '(id)';
        await q(sequelize, `INSERT INTO ${spec.table} (episode_id, ${cols.map(quoted).join(', ')}) VALUES (:episodeId, ${vals})
          ON CONFLICT ${conflict} DO UPDATE SET ${sets.join(', ')}`, repl, t);
      }
    }
    return { restored: versionId };
  });
}

// ── Reads: layout, mix, findings and review readiness ─────────────────────────

/**
 * Everything a review-ready preview needs, checked now: the edit's own
 * findings (editTimeline.editFindings, coverage included) plus what needs
 * other tables: deleted or unlinked sources, a take whose performer changed
 * (source_performer_changed), and spoken lines with no current approved
 * voice take (line_audio_unapproved). ready is true only with no blocking
 * finding.
 */
async function reviewReadiness(sequelize, { episodeId }) {
  return sequelize.transaction(async (t) => {
    const ep = await episodeRow(sequelize, episodeId, t);
    const live = await liveRows(sequelize, episodeId, t);
    const edit = editFrom(live);
    const findings = tl.editFindings(edit);

    for (const c of live.scene_clips) {
      if (c.source_kind === 'raw_clip') {
        const r = await one(sequelize, 'SELECT performer, deleted_at FROM episode_raw_clips WHERE id = :id', { id: c.source_id }, t);
        if (!r || r.deleted_at) findings.push({ code: 'scene_source_missing', severity: 'blocking', beat: c.beat_number, ref: c.id });
        else if (!SCENE_PERFORMERS.includes(r.performer)) findings.push({ code: 'source_performer_changed', severity: 'blocking', beat: c.beat_number, ref: c.id });
      } else {
        const a = await one(sequelize, `SELECT a.deleted_at, a.still_image_url, a.video_clip_url,
            EXISTS (SELECT 1 FROM scene_set_episodes l WHERE l.scene_set_id = a.scene_set_id AND l.episode_id = :episodeId AND l.deleted_at IS NULL) AS linked
          FROM scene_angles a WHERE a.id = :id`, { id: c.source_id, episodeId }, t);
        const hasMedia = a && (c.source_kind === 'angle_still' ? a.still_image_url : a.video_clip_url);
        if (!a || a.deleted_at || !a.linked || !hasMedia) findings.push({ code: 'scene_source_missing', severity: 'blocking', beat: c.beat_number, ref: c.id });
      }
    }
    for (const s of live.segments) {
      const r = await one(sequelize, 'SELECT performer, deleted_at FROM episode_raw_clips WHERE id = :id', { id: s.raw_clip_id }, t);
      if (!r || r.deleted_at) findings.push({ code: 'prime_source_missing', severity: 'blocking', ref: s.id });
      else if (r.performer !== PRIME) findings.push({ code: 'source_performer_changed', severity: 'blocking', ref: s.id });
    }

    // Spoken lines (not Prime's) each need a current approved take (Voice Studio B1).
    const lc = require('../utils/voiceLineContext');
    const script = typeof ep.script_content === 'string' ? ep.script_content : '';
    const contexts = lc.lineContexts(script);
    const { playableApprovals } = require('./voiceStudioService');
    const playable = await playableApprovals(sequelize, { episodeId });
    const approved = new Set(playable.takes.map((p) => `${p.beat_number}:${p.line_index}`));
    for (const ctx of contexts.all) {
      if (!ctx.speaker_key || ctx.prime) continue;
      if (ctx.beat_number < 1 || ctx.beat_number > 14) continue;
      if (!approved.has(`${ctx.beat_number}:${ctx.line_index}`)) {
        findings.push({ code: 'line_audio_unapproved', severity: 'blocking', beat: ctx.beat_number, line_index: ctx.line_index, speaker: ctx.speaker_written, words: ctx.words });
      }
    }

    const blocking = findings.filter((f) => f.severity === 'blocking');
    return {
      ready: blocking.length === 0,
      edit_revision: await currentRevision(sequelize, episodeId, t),
      script_revision: scriptRevision(script, ep.script_line_keys ?? null),
      script_seq: ep.script_seq,
      counts: { blocking: blocking.length, warning: findings.length - blocking.length },
      findings,
    };
  });
}

/** layoutAt for the live edit at t (ms). */
async function layoutAtTime(sequelize, { episodeId, t }) {
  const ms = int(t, 't', { max: MAX_CLIP_MS * 40 });
  const { edit, edit_revision: rev } = await loadEdit(sequelize, { episodeId });
  return { edit_revision: rev, duration_ms: tl.beatTimeline(edit).duration, layout: tl.layoutAt(edit, ms) };
}

async function mixPlanOf(sequelize, { episodeId }) {
  const { edit, edit_revision: rev } = await loadEdit(sequelize, { episodeId });
  return { edit_revision: rev, mix: tl.mixPlan(edit) };
}

module.exports = {
  EditError, setMedia, readVideoProbe, stableJson, ITEM_KINDS, MAX_CLIP_MS, PROBE_TIMEOUT_MS,
  loadEdit, setBeatMode, placeSceneClip, updateSceneClip,
  placeSegment, moveSegment, trimSegmentVideo, trimSegmentAudio, setSegmentAudio, setSegmentLayout, splitSegment, replaceTake,
  setPipSettings, addVisibilityRule, addItem, addAudioItem, removeRow,
  createVersion, listVersions, getVersion, restoreVersion,
  reviewReadiness, layoutAtTime, mixPlanOf,
};
