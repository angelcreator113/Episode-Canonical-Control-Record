'use strict';

/**
 * The episode's Lookbook (docs/design/2026-10-landing-and-stylesheet.md
 * Part 2; docs/reads/2026-10-10-lookbook-stylesheet-read.md §4; Task #2812):
 * her photos sorted into the style sheet's spots, plus the hair and nails
 * names, beauty notes, palette, mood words and tagline. Her photos are used
 * as-is; nothing is generated here, so nothing costs.
 *
 * Scope: the episode must be live, and every image read or written must
 * carry this episode's id (the route's :id), so one episode can never touch
 * another's photos. While the style sheet is approved, the Lookbook is
 * read-only (409 SHEET_APPROVED); reopening arrives with the sheet (#2814).
 *
 * Venue is pre-filled from the episode's event (its anchor, as the Wardrobe
 * and Scenes read it): the event's dressed look on its scene set, the set's
 * base and its angles. Nothing is copied; a pre-filled image becomes a row
 * only when she toggles it into the Lookbook (#2813). The two automatic
 * textures come from the saved look's piece images.
 */

const crypto = require('crypto');
const { uploadPng } = require('./episodeTitleOverlayService');

const CATEGORIES = Object.freeze(['unsorted', 'front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin', 'venue', 'inspo']);
// One live photo each; uploading or moving another into it replaces it.
const SINGLE_SLOT = Object.freeze(['front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin']);
// The 11 spots "style sheet ready (x of 11)" counts.
const READINESS_CATEGORIES = Object.freeze(CATEGORIES.filter((c) => c !== 'unsorted'));
const MAX_INSPO_UPLOADS = 2; // "Key inspo: up to two uploads"
const UPLOAD_TYPES = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' });
const MAX_FILES = 20;
const NOTE_KEYS = Object.freeze(['eyes', 'lips', 'skin']);
const HEX = /^#[0-9a-f]{6}$/i;

class LookbookError extends Error {
  constructor(message, status = 400, code = 'INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function loadLiveEpisode(models, episodeId) {
  const [rows] = await models.sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id: episodeId } });
  if (!rows[0]) throw new LookbookError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  return rows[0];
}

// The episode's live Lookbook, created on first use.
async function ensureLookbook(models, ep) {
  const { EpisodeLookbook } = models;
  const found = await EpisodeLookbook.findOne({ where: { episode_id: ep.id } });
  if (found) return found;
  try {
    return await EpisodeLookbook.create({ episode_id: ep.id, show_id: ep.show_id || null });
  } catch (err) {
    // Two first reads at once: the partial unique index keeps one row.
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    console.error('[Lookbook] concurrent create, reading the existing row:', err.message);
    return EpisodeLookbook.findOne({ where: { episode_id: ep.id } });
  }
}

/**
 * Editing an approved style sheet returns it to Draft (Task #2877): the
 * edit goes through, and the sheet must be approved again before it can be
 * exported. (Before, an approved sheet refused every edit until Reopen.)
 */
async function returnToDraft(models, lookbook) {
  if (lookbook.sheet_status !== 'approved') return;
  await models.EpisodeLookbook.update(
    { sheet_status: 'draft', approved_at: null, approved_by: null, sheet_inputs_hash: null },
    { where: { id: lookbook.id, episode_id: lookbook.episode_id } });
  lookbook.sheet_status = 'draft';
  lookbook.approved_at = null;
}

const imageView = (img) => ({
  id: img.id,
  category: img.category,
  source: img.source,
  image_url: img.image_url,
  scene_set_id: img.scene_set_id,
  scene_angle_id: img.scene_angle_id,
  scene_set_look_id: img.scene_set_look_id,
  wardrobe_id: img.wardrobe_id,
  in_lookbook: img.in_lookbook,
  sort_order: img.sort_order,
  content_type: img.content_type,
  width: img.width,
  height: img.height,
  file_size_bytes: img.file_size_bytes,
  file_name: img.file_name,
  created_at: img.created_at,
});

/**
 * "x of 11" (proposed in the read, §4; not yet ruled by Evoni): a spot
 * counts once it holds a live photo. Venue needs one marked "In lookbook";
 * inspo needs one of her uploads (automatic textures don't count).
 */
function readiness(images) {
  const counts = (cat) => images.some((i) => {
    if (i.category !== cat) return false;
    if (cat === 'venue') return i.in_lookbook;
    if (cat === 'inspo') return i.source === 'upload';
    return true;
  });
  const missing = READINESS_CATEGORIES.filter((c) => !counts(c));
  return { done: READINESS_CATEGORIES.length - missing.length, total: READINESS_CATEGORIES.length, missing };
}

function lookbookView(lookbook, images) {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  for (const img of images) byCategory[img.category].push(imageView(img));
  return {
    id: lookbook.id,
    episode_id: lookbook.episode_id,
    hair_name: lookbook.hair_name,
    nails_name: lookbook.nails_name,
    beauty_notes: lookbook.beauty_notes || {},
    palette: lookbook.palette,
    mood_words: lookbook.mood_words,
    tagline: lookbook.tagline,
    sheet_status: lookbook.sheet_status,
    approved_at: lookbook.approved_at,
    images_in: images.length,
    images: byCategory,
    readiness: readiness(images),
  };
}

async function liveImages(models, lookbook) {
  return models.EpisodeLookbookImage.findAll({
    where: { lookbook_id: lookbook.id, episode_id: lookbook.episode_id },
    order: [['category', 'ASC'], ['sort_order', 'ASC'], ['created_at', 'ASC']],
  });
}

const VENUE_SOURCES = Object.freeze(['scene_set_look', 'scene_set_base', 'scene_angle']);
const refColumn = (source) => ({ scene_set_look: 'scene_set_look_id', scene_set_base: 'scene_set_id', scene_angle: 'scene_angle_id' }[source]);

/**
 * What the episode's event offers the Lookbook: the venue images (event
 * look, set base, angles) and the pieces the automatic textures are cut
 * from. Read-only; a missing event or set gives empty lists.
 */
async function lookSources(models, ep) {
  const { sequelize } = models;
  const out = { event: null, scene_set: null, venue: [], texture_pieces: [] };
  let event = null;
  try {
    const { listEpisodeEvents } = require('./episodeEventsService');
    event = (await listEpisodeEvents(models, ep.id)).events[0] || null;
  } catch (err) {
    console.error('[Lookbook] reading the episode\'s event failed:', err.message);
  }
  if (event) out.event = { id: event.id, name: event.name || null };

  const setId = event && event.scene_set_id;
  if (setId) {
    const [[set]] = await sequelize.query(
      'SELECT id, name, base_still_url FROM scene_sets WHERE id = :setId AND deleted_at IS NULL',
      { replacements: { setId } });
    if (set) {
      out.scene_set = { id: set.id, name: set.name };
      const [[look]] = await sequelize.query(
        `SELECT id, image_url FROM scene_set_looks
          WHERE scene_set_id = :setId AND event_id = :eventId AND status = 'complete'
            AND image_url IS NOT NULL AND deleted_at IS NULL`,
        { replacements: { setId, eventId: event.id } });
      if (look) out.venue.push({ source: 'scene_set_look', ref_id: look.id, label: 'Event look', image_url: look.image_url, scene_set_id: set.id });
      if (set.base_still_url) out.venue.push({ source: 'scene_set_base', ref_id: set.id, label: 'Set base', image_url: set.base_still_url, scene_set_id: set.id });
      const [angles] = await sequelize.query(
        `SELECT id, angle_label, angle_name, COALESCE(enhanced_still_url, still_image_url) AS image_url
           FROM scene_angles
          WHERE scene_set_id = :setId AND deleted_at IS NULL
            AND COALESCE(enhanced_still_url, still_image_url) IS NOT NULL
          ORDER BY sort_order ASC, created_at ASC`,
        { replacements: { setId } });
      for (const a of angles) {
        out.venue.push({ source: 'scene_angle', ref_id: a.id, label: a.angle_label || a.angle_name || 'Angle', image_url: a.image_url, scene_set_id: set.id });
      }
    }
  }

  try {
    const { episodeLook } = require('./episodeLookCharges');
    const look = await episodeLook(sequelize, { episodeId: ep.id, event, showId: ep.show_id || null });
    out.texture_pieces = (look.pieces || []).filter((p) => p.image_url).slice(0, 2)
      .map((p) => ({ id: p.id, name: p.name, image_url: p.image_url }));
  } catch (err) {
    console.error('[Lookbook] reading the saved look for textures failed:', err.message);
  }
  return out;
}

// Each pre-filled venue image with its stored row's state, if any.
function venueView(sources, images) {
  return sources.venue.map((opt) => {
    const col = refColumn(opt.source);
    const row = images.find((i) => i.source === opt.source && i[col] === opt.ref_id);
    return { ...opt, image_id: row ? row.id : null, in_lookbook: row ? row.in_lookbook : false };
  });
}

async function getLookbook(models, episodeId) {
  const ep = await loadLiveEpisode(models, episodeId);
  const lookbook = await ensureLookbook(models, ep);
  const images = await liveImages(models, lookbook);
  const sources = await lookSources(models, ep);
  return {
    ...lookbookView(lookbook, images),
    event: sources.event,
    scene_set: sources.scene_set,
    venue_options: venueView(sources, images),
    texture_pieces: sources.texture_pieces,
  };
}

/**
 * Toggle a pre-filled venue image "In lookbook". The image must be one the
 * episode's event offers right now (never another set's); its row is made
 * on first toggle, pointing at the set, angle or look (nothing copied).
 */
async function setVenueImage(models, episodeId, { source, ref_id: refId, in_lookbook: inLookbook } = {}) {
  const ep = await loadLiveEpisode(models, episodeId);
  if (!VENUE_SOURCES.includes(source)) throw new LookbookError(`source is one of: ${VENUE_SOURCES.join(', ')}.`);
  if (typeof inLookbook !== 'boolean') throw new LookbookError('in_lookbook is true or false.');
  const lookbook = await ensureLookbook(models, ep);
  await returnToDraft(models, lookbook);
  const sources = await lookSources(models, ep);
  const opt = sources.venue.find((o) => o.source === source && o.ref_id === refId);
  if (!opt) throw new LookbookError("That image is not one of this episode's venue images.", 404, 'VENUE_IMAGE_NOT_FOUND');
  const col = refColumn(source);
  const { EpisodeLookbookImage } = models;
  const existing = await EpisodeLookbookImage.findOne({ where: { lookbook_id: lookbook.id, episode_id: ep.id, source, [col]: refId } });
  if (existing) {
    await EpisodeLookbookImage.update({ in_lookbook: inLookbook, category: 'venue' }, { where: { id: existing.id, episode_id: ep.id } });
  } else {
    await EpisodeLookbookImage.create({
      lookbook_id: lookbook.id,
      episode_id: ep.id,
      category: 'venue',
      source,
      image_url: opt.image_url,
      scene_set_id: opt.scene_set_id,
      [col]: refId,
      in_lookbook: inLookbook,
    });
  }
  return getLookbook(models, episodeId);
}

// ── Lookbook fields ──

function cleanText(value, max, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new LookbookError(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new LookbookError(`${label} is longer than ${max} characters.`);
  return trimmed || null;
}

function cleanFields(body = {}) {
  const out = {};
  if ('hair_name' in body) out.hair_name = cleanText(body.hair_name, 120, 'The hair name');
  if ('nails_name' in body) out.nails_name = cleanText(body.nails_name, 120, 'The nails name');
  if ('tagline' in body) out.tagline = cleanText(body.tagline, 200, 'The tagline');
  if ('beauty_notes' in body) {
    const notes = body.beauty_notes || {};
    if (typeof notes !== 'object' || Array.isArray(notes)) throw new LookbookError('Beauty notes must be { eyes, lips, skin }.');
    const unknown = Object.keys(notes).filter((k) => !NOTE_KEYS.includes(k));
    if (unknown.length) throw new LookbookError(`Unknown beauty note: ${unknown.join(', ')}.`);
    out.beauty_notes = {};
    for (const k of NOTE_KEYS) {
      const v = cleanText(notes[k], 600, `The ${k} note`);
      if (v) out.beauty_notes[k] = v;
    }
  }
  if ('palette' in body) {
    const p = body.palette;
    if (p === null) out.palette = null;
    else {
      if (!Array.isArray(p) || p.length > 5) throw new LookbookError('The palette is at most five colours.');
      out.palette = p.map((sw) => {
        if (!sw || !HEX.test(sw.hex || '')) throw new LookbookError('Each palette colour needs a hex like #B8962E.');
        const source = sw.source || 'edited';
        if (!['auto', 'edited'].includes(source)) throw new LookbookError("A palette colour's source is auto or edited.");
        return { hex: sw.hex.toUpperCase(), source };
      });
    }
  }
  if ('mood_words' in body) {
    const m = body.mood_words;
    if (m === null) out.mood_words = null;
    else {
      if (!Array.isArray(m) || m.length > 12) throw new LookbookError('Mood words are a list of at most 12.');
      out.mood_words = m.map((w) => cleanText(w, 40, 'A mood word')).filter(Boolean);
    }
  }
  return out;
}

async function updateLookbook(models, episodeId, body) {
  const ep = await loadLiveEpisode(models, episodeId);
  const fields = cleanFields(body);
  const lookbook = await ensureLookbook(models, ep);
  await returnToDraft(models, lookbook);
  if (Object.keys(fields).length) {
    await models.EpisodeLookbook.update(fields, { where: { id: lookbook.id, episode_id: ep.id } });
  }
  return getLookbook(models, episodeId);
}

// ── Images ──

function cleanCategory(category, fallback = 'unsorted') {
  const c = category === undefined || category === null || category === '' ? fallback : String(category);
  if (!CATEGORIES.includes(c)) throw new LookbookError(`Unknown spot "${c}". Use one of: ${CATEGORIES.join(', ')}.`, 400, 'INVALID_CATEGORY');
  return c;
}

async function imageSize(buffer) {
  try {
    const sharp = require('sharp');
    const { width, height } = await sharp(buffer).metadata();
    return { width: width || null, height: height || null };
  } catch (err) {
    console.error('[Lookbook] reading image size failed:', err.message);
    return { width: null, height: null };
  }
}

// Soft-delete the photo now in a single-photo spot (a replace).
async function vacateSlot(models, lookbook, category, transaction, keepId = null) {
  if (!SINGLE_SLOT.includes(category)) return;
  const { Op } = require('sequelize');
  const where = { lookbook_id: lookbook.id, episode_id: lookbook.episode_id, category };
  if (keepId) where.id = { [Op.ne]: keepId };
  await models.EpisodeLookbookImage.destroy({ where, transaction });
}

async function assertInspoRoom(models, lookbook, adding, transaction, exceptId = null) {
  const { Op } = require('sequelize');
  const where = { lookbook_id: lookbook.id, episode_id: lookbook.episode_id, category: 'inspo', source: 'upload' };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  const n = await models.EpisodeLookbookImage.count({ where, transaction });
  if (n + adding > MAX_INSPO_UPLOADS) {
    throw new LookbookError(`Key inspo holds up to ${MAX_INSPO_UPLOADS} of your photos; remove one first.`, 409, 'INSPO_FULL');
  }
}

/**
 * Add photos (multipart "files"). Without a category they land in the
 * To sort tray; with a single-photo spot, exactly one photo replaces the
 * one there.
 */
async function addImages(models, episodeId, files = [], { category } = {}) {
  const ep = await loadLiveEpisode(models, episodeId);
  const cat = cleanCategory(category);
  if (!files.length) throw new LookbookError('Choose PNG, JPEG or WebP photos to upload.', 400, 'NO_FILE');
  if (files.length > MAX_FILES) throw new LookbookError(`Upload at most ${MAX_FILES} photos at once.`);
  if (SINGLE_SLOT.includes(cat) && files.length > 1) throw new LookbookError(`The ${cat} spot holds one photo.`);
  for (const f of files) {
    if (!f.buffer || !f.buffer.length) throw new LookbookError('One of the files is empty.', 400, 'NO_FILE');
    if (!UPLOAD_TYPES[f.mimetype]) throw new LookbookError('Photos must be PNG, JPEG or WebP.', 400, 'INVALID_TYPE');
  }
  const lookbook = await ensureLookbook(models, ep);
  await returnToDraft(models, lookbook);
  if (cat === 'inspo') await assertInspoRoom(models, lookbook, files.length);

  // Upload first; the rows are written together once every file is stored.
  const stored = [];
  for (const f of files) {
    const key = `episodes/${ep.id}/lookbook/${crypto.randomUUID()}.${UPLOAD_TYPES[f.mimetype]}`;
    const url = await uploadPng(f.buffer, key, f.mimetype);
    stored.push({ f, key, url, size: await imageSize(f.buffer) });
  }
  const created = await models.sequelize.transaction(async (transaction) => {
    await vacateSlot(models, lookbook, cat, transaction);
    const rows = [];
    for (const { f, key, url, size } of stored) {
      rows.push(await models.EpisodeLookbookImage.create({
        lookbook_id: lookbook.id,
        episode_id: ep.id,
        category: cat,
        source: 'upload',
        image_url: url,
        s3_key: url.startsWith('data:') ? null : key,
        content_type: f.mimetype,
        width: size.width,
        height: size.height,
        file_size_bytes: f.buffer.length,
        file_name: f.originalname ? String(f.originalname).slice(0, 255) : null,
      }, { transaction }));
    }
    return rows;
  });
  return { images: created.map(imageView), lookbook: await getLookbook(models, episodeId) };
}

// A photo of this episode's Lookbook, or 404 (never another episode's).
async function findOwnImage(models, ep, imageId) {
  const img = await models.EpisodeLookbookImage.findOne({ where: { id: imageId, episode_id: ep.id } });
  if (!img) throw new LookbookError('Photo not found in this episode\'s Lookbook', 404, 'IMAGE_NOT_FOUND');
  return img;
}

/** Sort a photo into a spot, toggle "In lookbook", or reorder it. */
async function updateImage(models, episodeId, imageId, body = {}) {
  const ep = await loadLiveEpisode(models, episodeId);
  const lookbook = await ensureLookbook(models, ep);
  await returnToDraft(models, lookbook);
  const img = await findOwnImage(models, ep, imageId);
  const changes = {};
  if ('category' in body) changes.category = cleanCategory(body.category, img.category);
  if ('in_lookbook' in body) {
    if (typeof body.in_lookbook !== 'boolean') throw new LookbookError('in_lookbook is true or false.');
    changes.in_lookbook = body.in_lookbook;
  }
  if ('sort_order' in body) {
    if (!Number.isInteger(body.sort_order) || body.sort_order < 0) throw new LookbookError('sort_order is a whole number, 0 or more.');
    changes.sort_order = body.sort_order;
  }
  await models.sequelize.transaction(async (transaction) => {
    if (changes.category && changes.category !== img.category) {
      if (changes.category === 'inspo' && img.source === 'upload') await assertInspoRoom(models, lookbook, 1, transaction, img.id);
      await vacateSlot(models, lookbook, changes.category, transaction, img.id);
    }
    if (Object.keys(changes).length) {
      await models.EpisodeLookbookImage.update(changes, { where: { id: img.id, episode_id: ep.id }, transaction });
    }
  });
  const after = await findOwnImage(models, ep, imageId);
  return { image: imageView(after), lookbook: await getLookbook(models, episodeId) };
}

/** Remove a photo (soft delete; the stored file is kept). */
async function deleteImage(models, episodeId, imageId) {
  const ep = await loadLiveEpisode(models, episodeId);
  const lookbook = await ensureLookbook(models, ep);
  await returnToDraft(models, lookbook);
  const img = await findOwnImage(models, ep, imageId);
  await models.EpisodeLookbookImage.destroy({ where: { id: img.id, episode_id: ep.id } });
  return { deleted: img.id, lookbook: await getLookbook(models, episodeId) };
}

module.exports = {
  CATEGORIES,
  SINGLE_SLOT,
  READINESS_CATEGORIES,
  MAX_INSPO_UPLOADS,
  MAX_FILES,
  UPLOAD_TYPES,
  LookbookError,
  readiness,
  cleanFields,
  getLookbook,
  updateLookbook,
  setVenueImage,
  lookSources,
  VENUE_SOURCES,
  addImages,
  updateImage,
  deleteImage,
};
