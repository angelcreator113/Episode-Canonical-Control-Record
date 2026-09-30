'use strict';

/**
 * Episode task list approval and its overlay (Task #2395, ruling P14, Evoni
 * 2026-09-30, verbatim):
 *
 *   "An episode's task list can be approved; approving offers "Design
 *    task-list overlay" (cost shown) in the event's visual direction; it
 *    becomes an episode overlay placed on the tasks/deadline beat, replacing
 *    an earlier one."
 *
 * The task list is the episode's one list, episode_todo_lists.social_tasks
 * (T2, docs/EVENT_EPISODE_FLOW.md §8(bb)): host requirements, brand
 * deliverables, Lala's goals and optional ideas. The wardrobe list stays
 * separate (T7) and is not part of it.
 *
 * State lives on the episode_todo_lists row (migration 20261001150000):
 *   task_list_approved_at / task_list_approved_hash — the approval. It holds
 *     only while the hash equals the hash of the list as it stands now, so
 *     any edit to the list's content (a task added, removed, reworded,
 *     reordered, its source or required flag changed) un-approves it without
 *     every edit path having to clear anything. Ticking a task done does not
 *     change the content.
 *   task_overlay_asset_id / task_overlay_hash — the current overlay and the
 *     list it was designed from. It is outdated when that hash differs from
 *     the current one.
 *
 * Designing needs the list approved (409 TASK_LIST_NOT_APPROVED). The image
 * is a text-free background generated in the show's style (shows.style_prefix
 * via uiOverlayService.getStylePrefix, with the episode's show_id) and the
 * source event's visual direction (eventVisualDirection, as the invitation
 * and the title card use it), with the tasks' own text composited on it
 * (taskListOverlayCompositor, the invitation's Canvas + Sharp approach).
 * The overlay is an assets row (UI_OVERLAY, UI.OVERLAY.TASK_LIST) with the
 * episode's show_id and episode_id and metadata.overlay_type set to the
 * show's task-list overlay type key (else 'TodoListOverlay'). In one
 * transaction it replaces the earlier one: every earlier live task-list
 * overlay of the episode is soft-deleted, with its timeline placements.
 * Then it is placed on the tasks/deadline beat — canonical beat 9,
 * "Reminder/Deadline", screen_action TODO_LIST — by the rule the invitation
 * uses (episodeBeatPlacement).
 */

const crypto = require('crypto');
const imageGen = require('./imageGenerationService');
const compositor = require('./taskListOverlayCompositor');
const { deriveEventVisualDirection } = require('./eventVisualDirection');
const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
const { normalizeOverlayKey } = require('./timelinePlacementService');
const { socialTaskSource, isSocialTaskRequired } = require('../utils/socialTaskSource');

const TASK_LIST_ROLE = 'UI.OVERLAY.TASK_LIST';
const TASK_LIST_SCREEN_ACTION = 'TODO_LIST';
const TASK_LIST_BEAT = CANONICAL_BEATS.find((b) => b.screen_action === TASK_LIST_SCREEN_ACTION) || null;
const DEFAULT_TASK_LIST_OVERLAY_KEY = 'TodoListOverlay';
// The exact generation options of the background; the estimate shown before
// designing is priced from these same options. Portrait: the overlay is shown
// on Lala's Phone (beat 9's surface).
const TASK_LIST_OVERLAY_OPTIONS = Object.freeze({ size: 'portrait', quality: 'hd', useCase: 'overlay' });

// Spellings of a to-do / task-list overlay type, normalized via
// normalizeOverlayKey. The wardrobe checklist's keys (wardrobe_list,
// todo_checklist) are deliberately absent: T7 keeps that list separate.
const TASK_LIST_TYPE_KEYS = new Set([
  'todolistoverlay', 'todolist', 'todo', 'todos', 'todooverlay',
  'tasklistoverlay', 'tasklist', 'tasks', 'missionlist', 'missions',
  'reminderdeadline', 'deadline',
]);

class TaskListOverlayError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isTaskListOverlayType(typeKey, name) {
  return TASK_LIST_TYPE_KEYS.has(normalizeOverlayKey(typeKey))
    || TASK_LIST_TYPE_KEYS.has(normalizeOverlayKey(name));
}

/** Estimated cost of one overlay, from the image rate table. */
function estimateTaskListOverlay() {
  const e = imageGen.estimateGenerationCost(TASK_LIST_OVERLAY_OPTIONS);
  return { usd: e.usd, priced: e.priced, unit: e.unit, units: e.units, model: e.model };
}

function parseTasks(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list || '[]'); } catch (err) {
      console.warn('[TaskListOverlay] social_tasks parse failed:', err.message);
      list = [];
    }
  }
  return Array.isArray(list) ? list : [];
}

/**
 * The list's content as the overlay shows it (pure): label, description,
 * source and required, in list order. Completion and bookkeeping fields are
 * left out, so ticking a task never changes it.
 */
function taskListContent(tasks) {
  return parseTasks(tasks)
    .filter((t) => t && String(t.label || '').trim())
    .map((t) => ({
      label: String(t.label).trim(),
      description: String(t.description || '').trim(),
      source: socialTaskSource(t),
      required: isSocialTaskRequired(t),
    }));
}

/** sha256 of the list's content (pure). */
function taskListHash(tasks) {
  return crypto.createHash('sha256').update(JSON.stringify(taskListContent(tasks))).digest('hex');
}

/**
 * Approval and overlay state (pure).
 * @param {object|null} row — episode_todo_lists row (social_tasks, task_list_*, task_overlay_*) or null
 * @param {object} [overlay] — the current overlay's assets row (s3_url_processed, s3_url_raw, metadata)
 */
function taskListOverlayState(row, overlay = null) {
  const content = row ? taskListContent(row.social_tasks) : [];
  const hash = content.length > 0 ? taskListHash(row.social_tasks) : null;
  const approved = Boolean(row?.task_list_approved_at) && Boolean(hash) && row.task_list_approved_hash === hash;
  const hasOverlay = Boolean(row?.task_overlay_asset_id);
  const outdated = hasOverlay && row.task_overlay_hash !== hash;
  let offer = null;
  if (hash && (!hasOverlay || outdated) && (approved || outdated)) {
    offer = {
      offered: true,
      kind: hasOverlay ? 'redesign' : 'design',
      // An outdated overlay's redesign is offered at once (as P11 does for
      // the title card); the changed list is approved as part of it.
      requires_approval: !approved,
      estimate: estimateTaskListOverlay(),
    };
  }
  let meta = overlay?.metadata || {};
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch (err) {
      console.warn('[TaskListOverlay] overlay metadata parse failed:', err.message);
      meta = {};
    }
  }
  return {
    exists: Boolean(row),
    task_count: content.length,
    hash,
    approved,
    approved_at: approved ? row.task_list_approved_at : null,
    overlay: hasOverlay ? {
      asset_id: row.task_overlay_asset_id,
      designed_hash: row.task_overlay_hash || null,
      outdated,
      image_url: overlay ? (overlay.s3_url_processed || overlay.s3_url_raw || null) : null,
      overlay_type: meta.overlay_type || null,
      beat: meta.beat_number ? { number: meta.beat_number, name: meta.beat_name || null } : null,
    } : null,
    offer: offer || { offered: false },
  };
}

/**
 * The background prompt (pure). The show's style leads; the event's visual
 * direction sets background, frame, decoration, palette and richness. No
 * text: the tasks are composited on afterwards.
 */
function buildTaskListBackgroundPrompt({ stylePrefix = '', direction }) {
  const d = direction || deriveEventVisualDirection(null);
  return [
    `${stylePrefix}A luxury to-do list card BACKGROUND for a phone screen, flat graphic design, portrait orientation, filling the whole image edge to edge.`,
    'CRITICAL RULES: NO TEXT anywhere on the image. Zero text. No words, no letters, no numbers, no checkboxes, no lines of writing — the task list is added separately.',
    'Leave a large clear central area (about 75% of the image) plain and light so a written list reads cleanly on it; decoration frames the edges only.',
    `Visual direction — the same as this episode's event invitation (${d.theme} theme), so the invitation, title card and task list read as one production:`,
    `Background: ${d.background}.`,
    `Border/Frame: ${d.border}.`,
    `Decorative elements: ${d.florals} — edges and corners only, never in the centre.`,
    d.palette && d.palette.length > 0 ? `Color palette emphasis: ${d.palette.join(', ')}.` : '',
    `Richness: ${d.richness}.`,
    `Atmosphere: ${d.atmosphere}.`,
    'Mood: the Reminder/Deadline beat — a quiet sense of time ticking toward the event, never cluttered.',
  ].filter(Boolean).join('\n');
}

// ── I/O seams (replaced in tests; no provider or bucket is ever reached) ──

function storageBucket() {
  return process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || null;
}

const io = {
  storageConfigured() {
    return Boolean(storageBucket());
  },
  async fetchImage(url) {
    const axios = require('axios');
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    return Buffer.from(res.data);
  },
  async uploadPng(buffer, episodeId) {
    const bucket = storageBucket();
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const region = process.env.AWS_REGION || 'us-east-1';
    const key = `overlays/episode-task-list/${episodeId}/${crypto.randomUUID()}.png`;
    await new S3Client({ region }).send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: buffer, ContentType: 'image/png', CacheControl: 'max-age=31536000',
    }));
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  },
};

// ── Queries ──

async function loadEpisodeList(sequelize, episodeId, transaction) {
  const [row] = await sequelize.query(
    `SELECT e.id AS episode_id, e.show_id, e.title, e.episode_number,
            t.id AS list_id, t.social_tasks, t.social_tasks::text AS social_tasks_text,
            t.task_list_approved_at, t.task_list_approved_hash, t.task_overlay_asset_id, t.task_overlay_hash
       FROM episodes e
       LEFT JOIN episode_todo_lists t ON t.episode_id = e.id AND t.deleted_at IS NULL
      WHERE e.id = :episodeId AND e.deleted_at IS NULL
      LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  if (!row) return null;
  return { episode: row, list: row.list_id ? row : null };
}

async function loadOverlayAsset(sequelize, assetId) {
  if (!assetId) return null;
  const [asset] = await sequelize.query(
    `SELECT id, s3_url_processed, s3_url_raw, metadata FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { assetId }, type: sequelize.QueryTypes.SELECT }
  );
  return asset || null;
}

/** The show's task-list overlay type_key, else 'TodoListOverlay'. */
async function resolveTaskListOverlayKey(sequelize, showId) {
  if (!showId) return DEFAULT_TASK_LIST_OVERLAY_KEY;
  try {
    const [rows] = await sequelize.query(
      `SELECT type_key, name FROM ui_overlay_types
        WHERE show_id = :showId AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC`,
      { replacements: { showId } }
    );
    const match = (rows || []).find((t) => isTaskListOverlayType(t.type_key, t.name));
    return match?.type_key || DEFAULT_TASK_LIST_OVERLAY_KEY;
  } catch (err) {
    console.warn('[TaskListOverlay] overlay type lookup failed:', err.message);
    return DEFAULT_TASK_LIST_OVERLAY_KEY;
  }
}

function notFound() {
  return new TaskListOverlayError('Episode not found', 404, 'EPISODE_NOT_FOUND');
}

/** GET state. */
async function getTaskListOverlayState(models, episodeId) {
  const loaded = await loadEpisodeList(models.sequelize, episodeId);
  if (!loaded) throw notFound();
  const { list } = loaded;
  return taskListOverlayState(list, await loadOverlayAsset(models.sequelize, list?.task_overlay_asset_id));
}

/**
 * Approve the episode's task list as it stands. `expectedHash`, when given,
 * must be the current list's hash (the list the person saw), else 409
 * TASK_LIST_CHANGED.
 */
async function approveTaskList(models, episodeId, { expectedHash } = {}) {
  const { sequelize } = models;
  const loaded = await loadEpisodeList(sequelize, episodeId);
  if (!loaded) throw notFound();
  const { list } = loaded;
  if (!list || taskListContent(list.social_tasks).length === 0) {
    throw new TaskListOverlayError('The episode has no task list to approve.', 400, 'TASK_LIST_EMPTY');
  }
  const hash = taskListHash(list.social_tasks);
  if (expectedHash !== undefined && expectedHash !== null && expectedHash !== hash) {
    throw new TaskListOverlayError('The task list changed since this page loaded. Reload and approve the current list.', 409, 'TASK_LIST_CHANGED');
  }
  // The list must still be the one hashed: compare its stored text.
  const [rows] = await sequelize.query(
    `UPDATE episode_todo_lists
        SET task_list_approved_at = NOW(), task_list_approved_hash = :hash, updated_at = NOW()
      WHERE id = :listId AND deleted_at IS NULL AND social_tasks::text = :tasksText
      RETURNING id, social_tasks, task_list_approved_at, task_list_approved_hash, task_overlay_asset_id, task_overlay_hash`,
    { replacements: { hash, listId: list.list_id, tasksText: list.social_tasks_text } }
  );
  if (!rows || rows.length === 0) {
    throw new TaskListOverlayError('The task list changed while approving. Reload and approve the current list.', 409, 'TASK_LIST_CHANGED');
  }
  return taskListOverlayState(rows[0], await loadOverlayAsset(sequelize, rows[0].task_overlay_asset_id));
}

/**
 * Design (or redesign) the episode's task-list overlay. Requires the current
 * list approved. `showId`, when given, must be the episode's show.
 * Budget refusals from the image service propagate (status 429) before
 * anything is written.
 */
async function designTaskListOverlay(models, episodeId, { showId = null } = {}) {
  const { sequelize } = models;
  const loaded = await loadEpisodeList(sequelize, episodeId);
  if (!loaded) throw notFound();
  const { episode, list } = loaded;
  if (showId && episode.show_id && episode.show_id !== showId) {
    throw new TaskListOverlayError('Episode not found in this show', 404, 'EPISODE_NOT_IN_SHOW');
  }
  const state = taskListOverlayState(list);
  if (!state.approved) {
    throw new TaskListOverlayError(
      'Approve this episode\'s task list first — the overlay is designed from the approved list (Career Checklist, Approve task list).',
      409, 'TASK_LIST_NOT_APPROVED'
    );
  }
  // Refuse before spending on an image that could not be finished.
  if (!compositor.compositingAvailable()) {
    throw new TaskListOverlayError('Text compositing (canvas/sharp) is not available on this server.', 503, 'COMPOSITING_UNAVAILABLE');
  }
  if (!io.storageConfigured()) {
    throw new TaskListOverlayError('No image storage bucket is configured.', 503, 'STORAGE_UNAVAILABLE');
  }

  const ownerShowId = episode.show_id || showId;
  const hash = state.hash;
  const content = taskListContent(list.social_tasks);

  const { getStylePrefix } = require('./uiOverlayService');
  const { findSourceEvent } = require('./episodeMoneyService');
  const stylePrefix = ownerShowId ? await getStylePrefix(ownerShowId, models) : '';
  const event = await findSourceEvent(sequelize, episodeId);
  const direction = deriveEventVisualDirection(event);
  const prompt = buildTaskListBackgroundPrompt({ stylePrefix, direction });
  const layerContent = compositor.buildTaskListLayerContent(content, {
    eventName: event?.name || null,
    eventDate: event?.event_date || null,
    direction,
  });

  const backgroundUrl = await imageGen.generateImageUrl(prompt, TASK_LIST_OVERLAY_OPTIONS);
  if (!backgroundUrl) throw new TaskListOverlayError('Image generation did not return an image.', 502, 'IMAGE_EMPTY');
  const background = await io.fetchImage(backgroundUrl);
  const composite = await compositor.compositeTaskList(background, layerContent);
  const url = await io.uploadPng(composite.buffer, episodeId);

  const overlayType = await resolveTaskListOverlayKey(sequelize, ownerShowId);
  const assetId = crypto.randomUUID();
  const label = event?.name ? `${event.name} — Task List` : `${episode.title || 'Episode'} — Task List`;
  const metadata = {
    source: 'episode-task-list-overlay',
    overlay_type: overlayType,
    episode_task_list: true,
    task_list_hash: hash,
    task_count: content.length,
    tasks_drawn: composite.drawn,
    event_id: event ? event.id : null,
    theme: direction.theme,
    accent: layerContent.accent,
    beat_number: TASK_LIST_BEAT ? TASK_LIST_BEAT.number : null,
    beat_name: TASK_LIST_BEAT ? TASK_LIST_BEAT.name : null,
    background_url: backgroundUrl,
    replaces_asset_id: list.task_overlay_asset_id || null,
    prompt,
  };

  let replaced = [];
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, approval_status, metadata, created_at, updated_at)
       VALUES (:id, :name, 'UI_OVERLAY', :role, 'EPISODE', 'EPISODE', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, 'approved', :metadata, NOW(), NOW())`,
      { replacements: {
        id: assetId, name: label, role: TASK_LIST_ROLE, url,
        showId: ownerShowId, episodeId, metadata: JSON.stringify(metadata),
      }, transaction }
    );
    // One current overlay: every earlier live task-list overlay of this
    // episode is soft-deleted, and its placements with it.
    const [old] = await sequelize.query(
      `UPDATE assets SET deleted_at = NOW(), updated_at = NOW()
        WHERE episode_id = :episodeId AND asset_role = :role AND deleted_at IS NULL AND id <> :assetId
        RETURNING id`,
      { replacements: { episodeId, role: TASK_LIST_ROLE, assetId }, transaction }
    );
    replaced = (old || []).map((r) => r.id);
    const [[reg]] = await sequelize.query(
      "SELECT to_regclass('public.timeline_placements') IS NOT NULL AS present",
      { transaction }
    );
    if (replaced.length > 0 && reg?.present) {
      await sequelize.query(
        `UPDATE timeline_placements SET deleted_at = NOW(), updated_at = NOW()
          WHERE episode_id = :episodeId AND asset_id IN (:replaced) AND deleted_at IS NULL`,
        { replacements: { episodeId, replaced }, transaction }
      );
    }
    await sequelize.query(
      `UPDATE episode_todo_lists SET task_overlay_asset_id = :assetId, task_overlay_hash = :hash, updated_at = NOW()
        WHERE id = :listId`,
      { replacements: { assetId, hash, listId: list.list_id }, transaction }
    );
  });

  const { placeOverlayOnBeat } = require('./episodeBeatPlacement');
  let placed = { placement: null, anchor: null, beat: null };
  try {
    placed = await placeOverlayOnBeat(models, {
      episodeId,
      assetId,
      canonicalBeat: TASK_LIST_BEAT,
      label: 'Task List',
      kind: 'task_list',
      source: 'episode-task-list-overlay',
      duration: 6,
      zIndex: 20,
      logTag: '[TaskListOverlay]',
    });
  } catch (err) {
    // The overlay is designed and stored; a failed placement is added by
    // hand from the timeline, so it does not undo the design.
    console.error('[TaskListOverlay] placing the overlay on the tasks beat failed:', err.message);
  }

  const after = await loadEpisodeList(sequelize, episodeId);
  return {
    assetId,
    imageUrl: url,
    overlayType,
    replaced,
    placement: placed.placement ? {
      id: placed.placement.id,
      anchor: placed.anchor,
      label: placed.placement.label || null,
      beat_number: placed.beat ? placed.beat.beat_number : null,
    } : null,
    state: taskListOverlayState(after?.list || null, { s3_url_processed: url, metadata }),
  };
}

/**
 * The episode's own task-list overlay for GET /ui-overlays/:showId?episode_id=,
 * or null.
 */
async function loadEpisodeTaskListOverlay(sequelize, { showId, episodeId }) {
  if (!sequelize || !episodeId) return null;
  const rows = await sequelize.query(
    `SELECT a.id, a.name, a.s3_url_processed, a.s3_url_raw, a.episode_id, a.metadata::text AS metadata_text
       FROM episode_todo_lists t
       JOIN assets a ON a.id = t.task_overlay_asset_id
      WHERE t.episode_id = :episodeId AND t.deleted_at IS NULL
        AND a.episode_id = :episodeId AND a.show_id = :showId AND a.deleted_at IS NULL
      LIMIT 1`,
    { replacements: { showId, episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  const row = rows?.[0];
  if (!row) return null;
  let metadata = {};
  try { metadata = row.metadata_text ? JSON.parse(row.metadata_text) : {}; } catch (err) {
    console.warn('[TaskListOverlay] overlay metadata parse failed:', err.message);
  }
  return {
    id: row.id,
    name: row.name,
    metadata,
    overlay_type: metadata.overlay_type || DEFAULT_TASK_LIST_OVERLAY_KEY,
    url: row.s3_url_processed || row.s3_url_raw,
    episode_id: row.episode_id,
  };
}

/**
 * Put the episode's task-list overlay into an overlay status list: it fills
 * the show's task-list type entry (as that episode's own), or is appended as
 * its own entry when the show has none. Pure; returns a new array.
 */
function mergeTaskListIntoOverlayStatus(status, overlay) {
  if (!overlay) return status;
  const fields = {
    generated: true,
    url: overlay.url || null,
    asset_id: overlay.id,
    bg_removed: false,
    custom_prompt: null,
    screen_links: null,
    image_fit: null,
    content_zones: null,
    is_episode_override: true,
    is_episode_task_list: true,
    variants: null,
  };
  const idx = status.findIndex((ot) => isTaskListOverlayType(ot.id, ot.name));
  if (idx >= 0) {
    return status.map((ot, i) => (i === idx ? { ...ot, ...fields } : ot));
  }
  return [...status, {
    id: overlay.overlay_type,
    name: 'Task List',
    category: 'phone',
    beat: TASK_LIST_BEAT ? `Beat ${TASK_LIST_BEAT.number}` : '',
    description: 'This episode\'s approved task list',
    prompt: null,
    sort_order: 101,
    lifecycle: 'per_episode',
    opens_screen: null,
    is_home: false,
    custom: false,
    ...fields,
  }];
}

module.exports = {
  TASK_LIST_ROLE,
  TASK_LIST_BEAT,
  TASK_LIST_SCREEN_ACTION,
  TASK_LIST_OVERLAY_OPTIONS,
  DEFAULT_TASK_LIST_OVERLAY_KEY,
  TaskListOverlayError,
  isTaskListOverlayType,
  estimateTaskListOverlay,
  taskListContent,
  taskListHash,
  taskListOverlayState,
  buildTaskListBackgroundPrompt,
  resolveTaskListOverlayKey,
  getTaskListOverlayState,
  approveTaskList,
  designTaskListOverlay,
  loadEpisodeTaskListOverlay,
  mergeTaskListIntoOverlayStatus,
  _io: io,
};
