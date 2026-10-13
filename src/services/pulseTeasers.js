'use strict';

/**
 * Teaser images (Task #3034; Evoni, 2026-10-12: "Teasers: cropped by default.
 * A deliberate detail—fabric, an accessory, part of a venue—fits SAL's visual
 * style. Use blur when concealing the full reveal matters. Create the teaser
 * from the existing image to avoid another generation charge";
 * docs/reads/2026-10-12-pulse-decisions-read.md §4).
 *
 *   TEASER_STYLES        crop | blur (crop is the default)
 *   DEFAULT_CROP         the detail when none is chosen: the middle of the image
 *   readCrop(value)      { value } with x, y, w, h as fractions, or { error }
 *   sourceImageUrl(db, reveal)  the full image the reveal hides: a post's
 *                        image, a fit, the cover, a city or its story bubble;
 *                        null for events and characters, or no image yet
 *   cutTeaser(buffer, { style, crop })  sharp only, no AI: the chosen region
 *                        scaled for display, or a strong blur of the whole
 *   makeTeaser(db, reveal)  cuts the teaser from the source image, uploads it
 *                        once (as pulseImageService does) and returns its URL,
 *                        or null with no source image
 *
 * A teaser response sends teaser_url in place of the full image URL; with no
 * teaser_url it sends no image at all, never the full one.
 */

const crypto = require('crypto');

const TEASER_STYLES = ['crop', 'blur'];
const DEFAULT_CROP = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
const DISPLAY_SIDE = 900;    // a teaser is shown small: the detail scaled to fit this
const BLUR_SIGMA = 40;       // strong enough that the reveal cannot be read through it
const MIN_CROP = 0.05;       // a region smaller than 5% of a side is not a detail

class TeaserError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const round = (n) => Math.round(n * 10000) / 10000;

/** The crop region from a request: fractions 0–1, inside the image, not too small. */
function readCrop(value) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== 'object' || Array.isArray(value)) return { error: 'crop must be { x, y, w, h } as fractions of the image.' };
  const out = {};
  for (const k of ['x', 'y', 'w', 'h']) {
    const n = Number(value[k]);
    if (!Number.isFinite(n) || n < 0 || n > 1) return { error: 'crop must be { x, y, w, h } as fractions of the image.' };
    out[k] = round(n);
  }
  if (out.w < MIN_CROP || out.h < MIN_CROP) return { error: 'The detail is too small: choose at least a twentieth of the image.' };
  if (out.x + out.w > 1.0001 || out.y + out.h > 1.0001) return { error: 'The detail must sit inside the image.' };
  return { value: out };
}

/** The full image a reveal hides, or null (events, characters, no image yet). */
async function sourceImageUrl(db, reveal) {
  const { sequelize } = db;
  const one = async (sql, replacements) => (await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT }))[0] || null;
  const kind = reveal.image_kind;
  if (reveal.item_type === 'post' || (reveal.item_type === 'image' && kind === 'post_photo')) {
    if (!/^[0-9a-f-]{36}$/i.test(reveal.item_id)) return null;
    return (await one('SELECT image_url FROM feed_posts WHERE id = :id AND deleted_at IS NULL', { id: reveal.item_id }))?.image_url || null;
  }
  if (reveal.item_type !== 'image') return null;
  if (kind === 'fit') {
    if (!/^[0-9a-f-]{36}$/i.test(reveal.item_id)) return null;
    return (await one('SELECT image_url FROM pulse_fits WHERE id = :id AND deleted_at IS NULL', { id: reveal.item_id }))?.image_url || null;
  }
  if (kind === 'cover') {
    const show = await one('SELECT metadata FROM shows WHERE id = :id', { id: reveal.show_id });
    return require('./pulseCoverService').readPulseCover(show?.metadata)?.url || null;
  }
  if (kind === 'city' || kind === 'city_bubble') {
    const row = await one(`SELECT data FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'`, {});
    const city = (Array.isArray(row?.data) ? row.data : []).find((c) => c && c.key === reveal.item_id);
    return (kind === 'city' ? city?.image_url : city?.bubble_image_url) || null;
  }
  return null;
}

/** The teaser image from the full one: the chosen detail scaled for display, or a strong blur. */
async function cutTeaser(buffer, { style = 'crop', crop = null } = {}) {
  const sharp = require('sharp');
  const image = sharp(buffer).rotate();
  if (style === 'blur') {
    return image
      .resize({ width: DISPLAY_SIDE, height: DISPLAY_SIDE, fit: 'inside', withoutEnlargement: true })
      .blur(BLUR_SIGMA)
      .flatten({ background: '#FAF7F0' })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  }
  // The metadata of the upright image: rotate() is applied before extract().
  const upright = await sharp(await image.toBuffer()).metadata();
  const r = crop || DEFAULT_CROP;
  const left = Math.min(upright.width - 1, Math.max(0, Math.round(r.x * upright.width)));
  const top = Math.min(upright.height - 1, Math.max(0, Math.round(r.y * upright.height)));
  const width = Math.max(1, Math.min(upright.width - left, Math.round(r.w * upright.width)));
  const height = Math.max(1, Math.min(upright.height - top, Math.round(r.h * upright.height)));
  return sharp(buffer).rotate()
    .extract({ left, top, width, height })
    .resize({ width: DISPLAY_SIDE, height: DISPLAY_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#FAF7F0' })
    .jpeg({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
}

/** The bytes of a stored image: a data URL decoded, else downloaded (as episodeTitleOverlayService loads images). */
async function imageBytes(url) {
  if (String(url).startsWith('data:')) return Buffer.from(String(url).split(',')[1] || '', 'base64');
  const axios = require('axios');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, maxContentLength: 25 * 1024 * 1024 });
  return Buffer.from(res.data);
}

/**
 * Cuts and uploads a teaser reveal's image; returns its URL, or null when
 * the item has no image. A TeaserError (502) when the image cannot be read.
 */
async function makeTeaser(db, reveal) {
  if (reveal.mode !== 'teaser') return null;
  const source = await sourceImageUrl(db, reveal);
  if (!source) return null;
  const { uploadPng } = require('./episodeTitleOverlayService');
  let buffer;
  try {
    buffer = await imageBytes(source);
  } catch (err) {
    console.error('[PulseTeasers] the image could not be read:', err.message);
    throw new TeaserError(502, 'The image could not be read to cut its teaser. Try again.');
  }
  let cut;
  try {
    cut = await cutTeaser(buffer, { style: reveal.teaser_style, crop: reveal.crop_json });
  } catch (err) {
    console.error('[PulseTeasers] the teaser could not be cut:', err.message);
    throw new TeaserError(502, 'The teaser could not be cut from that image.');
  }
  const key = `shows/pulse-teasers/${reveal.show_id}/${crypto.randomUUID()}.jpg`;
  return uploadPng(cut.data, key, 'image/jpeg');
}

module.exports = { TEASER_STYLES, DEFAULT_CROP, TeaserError, readCrop, sourceImageUrl, cutTeaser, makeTeaser };
