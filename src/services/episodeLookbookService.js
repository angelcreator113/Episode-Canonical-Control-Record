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

function assertDraft(lookbook) {
  if (lookbook.sheet_status === 'approved') {
    throw new LookbookError('The style sheet is approved; reopen it to change the Lookbook.', 409, 'SHEET_APPROVED');
  }
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

async function getLookbook(models, episodeId) {
  const ep = await loadLiveEpisode(models, episodeId);
  const lookbook = await ensureLookbook(models, ep);
  return lookbookView(lookbook, await liveImages(models, lookbook));
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
  assertDraft(lookbook);
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
  assertDraft(lookbook);
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
  assertDraft(lookbook);
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
  assertDraft(lookbook);
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
  addImages,
  updateImage,
  deleteImage,
};
