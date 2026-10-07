'use strict';

/**
 * The episode title overlay (ruling P11 as amended, Evoni 2026-09-30,
 * docs/EVENT_EPISODE_FLOW.md §8(w)), verbatim:
 *
 *   "The episode title card is a title overlay: the title set in real
 *   typefaces (never AI-rendered letters), styled from the event's visual
 *   direction (fonts, palette, gold/foil/shadow effects), with the episode
 *   number small beneath, rendered as a transparent PNG. An optional soft
 *   translucent backing band (20–40% opacity) can be switched on for
 *   readability. Approving the title offers 2–3 lettering style variants to
 *   choose from, at no image cost; an optional AI-generated decorative
 *   flourish behind the letters is offered separately with its cost shown.
 *   The current framed card remains available as a full-screen card option."
 *
 * The letters are drawn with node-canvas in the invitation's typefaces
 * (Cormorant Garamond and Libre Baskerville, installed and registered by
 * invitationCompositingService.checkFonts; its serif fallback when they are
 * not), never by an image model. Rendering costs nothing. The look comes
 * from the source event's visual direction (eventVisualDirection): its theme
 * sets the finish (gold foil, rose-gold foil, ink, sage) and its palette the
 * accent. The PNG is 1920×1080 with a transparent background.
 *
 * State on the episode row (migration 20261001200000):
 *   title_overlay_asset_id / title_overlay_title — the current overlay and
 *     the title it was made for (outdated when the title changes, as P11's
 *     card is);
 *   title_overlay_style — { variant, band: { enabled, opacity }, flourish:
 *     { asset_id, url } | null }.
 * The overlay is an assets row (role UI.OVERLAY.EPISODE_TITLE_TEXT); a new
 * one soft-deletes the earlier ones. The framed card (episodeTitleCardService,
 * role UI.OVERLAY.EPISODE_TITLE) stays as the full-screen option.
 *
 * The flourish is the only image-model call: an ornament generated in gold
 * on pure black (FLOURISH_OPTIONS, its estimate shown before), keyed to
 * transparency by brightness, and drawn behind the letters.
 */

const crypto = require('crypto');
const imageGen = require('./imageGenerationService');
const { deriveEventVisualDirection } = require('./eventVisualDirection');

const TITLE_OVERLAY_ROLE = 'UI.OVERLAY.EPISODE_TITLE_TEXT';
const FLOURISH_ROLE = 'UI.OVERLAY.EPISODE_TITLE_FLOURISH';
// P15's beat ruling (Evoni, 2026-09-30): "the title overlay is placed on
// Beat 1 (the opening); the framed card stays unplaced unless I place it."
const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
const TITLE_OVERLAY_BEAT = CANONICAL_BEATS.find((b) => b.number === 1) || null;
const WIDTH = 1920;
const HEIGHT = 1080;
const PREVIEW_SCALE = 0.5;
const BAND_MIN = 0.2;
const BAND_MAX = 0.4;
const BAND_DEFAULT = 0.3;
const FLOURISH_OPTIONS = Object.freeze({ size: 'landscape', quality: 'hd', useCase: 'overlay' });

// The 2–3 lettering variants offered on approval. `font` names the
// invitation family role (header: Cormorant Garamond, body: Libre
// Baskerville).
const VARIANTS = Object.freeze([
  Object.freeze({ key: 'classic', label: 'Classic serif', font: 'header', weight: 'bold', style: 'normal', upper: false, tracking: 0 }),
  Object.freeze({ key: 'italic', label: 'Editorial italic', font: 'body', weight: 'normal', style: 'italic', upper: false, tracking: 0 }),
  Object.freeze({ key: 'engraved', label: 'Engraved capitals', font: 'header', weight: 'normal', style: 'normal', upper: true, tracking: 0.16 }),
]);
const VARIANT_KEYS = VARIANTS.map((v) => v.key);

// The finish by the event's theme (eventVisualDirection.THEME_PRESETS).
const FINISHES = Object.freeze({
  gold_foil: { stops: ['#8A6A1F', '#E8C766', '#B8962E', '#F5E3A1', '#9C7A2B'], shadow: 'rgba(0,0,0,0.55)', band: '0,0,0' },
  rose_foil: { stops: ['#9E5B4F', '#E8B4A0', '#C98B7A', '#F5D5C8', '#A86A5C'], shadow: 'rgba(0,0,0,0.5)', band: '0,0,0' },
  ink: { stops: ['#141414', '#2A2A2A', '#141414'], shadow: 'rgba(255,255,255,0.55)', band: '255,255,255' },
  sage: { stops: ['#4E6147', '#7A9070', '#5E7355'], shadow: 'rgba(255,255,255,0.5)', band: '255,255,255' },
});
const THEME_FINISH = Object.freeze({
  'honey luxe': 'gold_foil',
  'formal glamour': 'gold_foil',
  'luxury intimate': 'gold_foil',
  'soft glam': 'rose_foil',
  'avant-garde': 'ink',
  'chic minimal': 'ink',
  'power fashion': 'ink',
  'romantic garden': 'sage',
  default: 'gold_foil',
});

// Palette words the event may use, as colours canvas can draw.
const NAMED_COLOURS = Object.freeze({
  gold: '#B8962E', champagne: '#D9C6A5', ivory: '#F5EFE0', cream: '#F3E9D2', blush: '#E8B4B8', 'rose gold': '#C98B7A',
  rose: '#C9727F', plum: '#6E3B5C', burgundy: '#6D1F2F', wine: '#722F37', emerald: '#2E6B4F', sage: '#8A9A7B',
  navy: '#1F2A44', black: '#111111', white: '#FFFFFF', silver: '#B9BDC4', lavender: '#B7A7D1', pink: '#E79AB0',
  red: '#B3261E', teal: '#2C7A7B', copper: '#B87333', bronze: '#8C6A3F', pearl: '#EDE6DA',
});

class TitleOverlayError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** A palette entry as a drawable colour, or null. */
function colourOf(entry) {
  const s = String(entry || '').trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(s)) return s;
  return NAMED_COLOURS[s] || null;
}

/** The look of the overlay from the event's visual direction (pure). */
function overlayLook(direction) {
  const theme = direction?.theme || 'default';
  const finishKey = THEME_FINISH[theme] || THEME_FINISH.default;
  const accent = (direction?.palette || []).map(colourOf).find(Boolean) || null;
  return { theme, finish: finishKey, ...FINISHES[finishKey], accent };
}

/** Validates a band body: { enabled, opacity } with opacity in 20–40%. */
function readBand(band) {
  const b = band && typeof band === 'object' ? band : {};
  const enabled = b.enabled === true;
  let opacity = b.opacity == null || b.opacity === '' ? BAND_DEFAULT : Number(b.opacity);
  if (!Number.isFinite(opacity)) return { error: 'band.opacity must be a number from 0.2 to 0.4' };
  if (opacity > 1) opacity /= 100; // 30 means 30%
  if (opacity < BAND_MIN || opacity > BAND_MAX) return { error: 'band.opacity must be from 0.2 to 0.4 (20–40%)' };
  return { value: { enabled, opacity: Math.round(opacity * 100) / 100 } };
}

function fontString(variant, size, families) {
  const family = variant.font === 'body' ? families.body : families.header;
  return `${variant.style === 'italic' ? 'italic ' : ''}${variant.weight === 'bold' ? 'bold ' : ''}${Math.round(size)}px "${family}", serif`;
}

// Text width with tracking (letter spacing as a share of the font size).
function trackedWidth(ctx, text, size, tracking) {
  if (!tracking) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + size * tracking;
  return w - size * tracking;
}

function drawTracked(ctx, text, centerX, y, size, tracking, mode) {
  if (!tracking) {
    ctx.textAlign = 'center';
    if (mode === 'stroke') ctx.strokeText(text, centerX, y); else ctx.fillText(text, centerX, y);
    return;
  }
  ctx.textAlign = 'left';
  let x = centerX - trackedWidth(ctx, text, size, tracking) / 2;
  for (const ch of text) {
    if (mode === 'stroke') ctx.strokeText(ch, x, y); else ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + size * tracking;
  }
}

/** Fit the title in at most two lines across 80% of the width (pure, given a canvas context). */
function layoutTitle(ctx, title, variant, families, width) {
  const text = variant.upper ? title.toUpperCase() : title;
  const maxWidth = width * 0.8;
  for (let size = 168; size >= 56; size -= 4) {
    ctx.font = fontString(variant, size, families);
    if (trackedWidth(ctx, text, size, variant.tracking) <= maxWidth) return { lines: [text], size };
  }
  const words = text.split(/\s+/);
  for (let size = 120; size >= 48; size -= 4) {
    ctx.font = fontString(variant, size, families);
    let best = null;
    for (let i = 1; i < words.length; i += 1) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const w = Math.max(trackedWidth(ctx, a, size, variant.tracking), trackedWidth(ctx, b, size, variant.tracking));
      if (w <= maxWidth && (!best || w < best.w)) best = { lines: [a, b], w };
    }
    if (best) return { lines: best.lines, size };
  }
  return { lines: [text], size: 48 };
}

/** Bright pixels stay, dark ones go: an ornament on black becomes transparent (in place). */
function keyByBrightness(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(d[i], d[i + 1], d[i + 2]);
    d[i + 3] = Math.min(255, Math.round(v * 1.15));
  }
  return imageData;
}

/**
 * Render the overlay as a transparent PNG buffer.
 *   { title, episodeNumber, direction, variant (key), band: {enabled, opacity},
 *     flourish: a loaded canvas Image or null, scale, families }
 */
function renderTitleOverlay({
  title, episodeNumber = null, direction = null, variant = 'classic', band = null, flourish = null, scale = 1, families,
}) {
  const { createCanvas } = require('canvas');
  const v = VARIANTS.find((x) => x.key === variant) || VARIANTS[0];
  const W = Math.round(WIDTH * scale);
  const H = Math.round(HEIGHT * scale);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const fams = families || { header: 'serif', body: 'serif' };
  const look = overlayLook(direction);
  const text = String(title || '').trim();

  const { lines, size } = layoutTitle(ctx, text, v, fams, WIDTH);
  const lineGap = size * 1.12;
  const numberSize = Math.max(26, Math.round(size * 0.24));
  const blockH = lines.length * lineGap + (episodeNumber ? numberSize * 2.2 : 0);
  const top = HEIGHT / 2 - blockH / 2;

  // The optional soft backing band, faded at its top and bottom edges.
  if (band?.enabled) {
    const pad = size * 0.55;
    const y0 = top - pad;
    const y1 = top + blockH + pad;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    const a = band.opacity;
    g.addColorStop(0, `rgba(${look.band},0)`);
    g.addColorStop(0.18, `rgba(${look.band},${a})`);
    g.addColorStop(0.82, `rgba(${look.band},${a})`);
    g.addColorStop(1, `rgba(${look.band},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, WIDTH, y1 - y0);
  }

  // The optional flourish, behind the letters.
  if (flourish) {
    const fw = WIDTH * 0.72;
    const fh = (flourish.height / flourish.width) * fw;
    const tmp = createCanvas(Math.round(fw), Math.round(fh));
    const tctx = tmp.getContext('2d');
    tctx.drawImage(flourish, 0, 0, fw, fh);
    tctx.putImageData(keyByBrightness(tctx.getImageData(0, 0, tmp.width, tmp.height)), 0, 0);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(tmp, (WIDTH - fw) / 2, HEIGHT / 2 - fh / 2);
    ctx.globalAlpha = 1;
  }

  // The title: a foil or ink gradient, with a shadow for depth and contrast.
  ctx.textBaseline = 'alphabetic';
  ctx.font = fontString(v, size, fams);
  const gradTop = top;
  const gradBottom = top + lines.length * lineGap;
  const grad = ctx.createLinearGradient(0, gradTop, 0, gradBottom);
  look.stops.forEach((c, i) => grad.addColorStop(i / (look.stops.length - 1), c));
  lines.forEach((line, i) => {
    const y = top + (i + 0.82) * lineGap;
    ctx.save();
    ctx.shadowColor = look.shadow;
    ctx.shadowBlur = size * 0.14;
    ctx.shadowOffsetY = size * 0.04;
    ctx.fillStyle = grad;
    drawTracked(ctx, line, WIDTH / 2, y, size, v.tracking, 'fill');
    ctx.restore();
    if (look.accent && look.finish.endsWith('foil')) {
      ctx.save();
      ctx.lineWidth = Math.max(1, size * 0.012);
      ctx.strokeStyle = look.accent;
      ctx.globalAlpha = 0.6;
      drawTracked(ctx, line, WIDTH / 2, y, size, v.tracking, 'stroke');
      ctx.restore();
    }
  });

  // The episode number, small beneath.
  if (episodeNumber) {
    const label = `EPISODE ${episodeNumber}`;
    const y = top + lines.length * lineGap + numberSize * 1.5;
    ctx.save();
    ctx.font = `${numberSize}px "${fams.body}", serif`;
    ctx.fillStyle = look.accent || look.stops[Math.floor(look.stops.length / 2)];
    ctx.shadowColor = look.shadow;
    ctx.shadowBlur = numberSize * 0.3;
    drawTracked(ctx, label, WIDTH / 2, y, numberSize, 0.3, 'fill');
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

async function fontFamiliesReady() {
  const invitation = require('./invitationCompositingService');
  try {
    await invitation.checkFonts();
  } catch (err) {
    console.warn('[TitleOverlay] font check failed; the serif fallback is used:', err.message);
  }
  return invitation.fontFamilies();
}

async function loadEpisode(sequelize, episodeId) {
  const [ep] = await sequelize.query(
    `SELECT id, show_id, title, episode_number, title_approved_at, title_approved_value,
            title_card_asset_id, title_card_title, title_overlay_asset_id, title_overlay_title, title_overlay_style
       FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  return ep || null;
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[TitleOverlay] stored JSON parse failed:', err.message);
    return fallback;
  }
}

/** The overlay's state on an episode row (pure). */
function titleOverlayState(ep, asset = null) {
  const title = ep.title || '';
  if (!ep.title_overlay_asset_id) return null;
  return {
    asset_id: ep.title_overlay_asset_id,
    designed_for: ep.title_overlay_title,
    outdated: ep.title_overlay_title !== title,
    style: parseJson(ep.title_overlay_style, null),
    image_url: asset ? (asset.s3_url_processed || asset.s3_url_raw || null) : null,
  };
}

function flourishEstimate() {
  const e = imageGen.estimateGenerationCost(FLOURISH_OPTIONS);
  return { usd: e.usd, priced: e.priced, unit: e.unit, units: e.units, model: e.model };
}

async function sourceDirection(sequelize, episodeId) {
  const { findSourceEvent } = require('./episodeMoneyService');
  const event = await findSourceEvent(sequelize, episodeId);
  if (!event) return { event: null, direction: null };
  const ev = { ...event, color_palette: parseJson(event.color_palette, event.color_palette) };
  return { event, direction: deriveEventVisualDirection(ev) };
}

function requireApproved(ep) {
  const approved = Boolean(ep.title_approved_at) && ep.title_approved_value === (ep.title || '');
  if (!approved) {
    throw new TitleOverlayError(
      'Approve this episode\'s title first: the title overlay is set from the approved title.', 409, 'TITLE_NOT_APPROVED'
    );
  }
}

/**
 * The 2–3 lettering variants for the approved title, as small PNG previews
 * (data URLs), at no image cost; with the band defaults and the flourish
 * estimate.
 */
async function getTitleOverlayVariants(models, episodeId) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) throw new TitleOverlayError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  requireApproved(ep);
  const families = await fontFamiliesReady();
  const { direction } = await sourceDirection(sequelize, episodeId);
  const variants = VARIANTS.map((v) => ({
    key: v.key,
    label: v.label,
    preview: `data:image/png;base64,${renderTitleOverlay({
      title: ep.title, episodeNumber: ep.episode_number, direction, variant: v.key, scale: PREVIEW_SCALE, families,
    }).toString('base64')}`,
  }));
  return {
    variants,
    look: overlayLook(direction),
    band: { min: BAND_MIN, max: BAND_MAX, default: BAND_DEFAULT },
    flourish_estimate: flourishEstimate(),
  };
}

async function uploadPng(buffer, key) {
  const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
  if (!S3_BUCKET) return `data:image/png;base64,${buffer.toString('base64')}`;
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  const s3 = new S3Client({ region: AWS_REGION });
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

async function loadImage(url) {
  const { loadImage: load } = require('canvas');
  if (String(url).startsWith('data:')) return load(Buffer.from(url.split(',')[1], 'base64'));
  const axios = require('axios');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return load(Buffer.from(res.data));
}

/**
 * Save the overlay: the chosen variant and band, rendered full size, as the
 * episode's current title overlay. No image cost. `flourish: false` drops
 * the flourish; otherwise a flourish already made is kept.
 */
async function saveTitleOverlay(models, episodeId, { variant, band, flourish } = {}) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) throw new TitleOverlayError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  requireApproved(ep);
  const key = variant || parseJson(ep.title_overlay_style, {})?.variant || 'classic';
  if (!VARIANT_KEYS.includes(key)) {
    throw new TitleOverlayError(`variant must be one of ${VARIANT_KEYS.join(', ')}`, 400, 'INVALID_VARIANT');
  }
  const readB = readBand(band === undefined ? parseJson(ep.title_overlay_style, {})?.band : band);
  if (readB.error) throw new TitleOverlayError(readB.error, 400, 'INVALID_BAND');
  const previous = parseJson(ep.title_overlay_style, {}) || {};
  const flourishRef = flourish === false ? null : (flourish && typeof flourish === 'object' ? flourish : previous.flourish || null);
  return writeOverlay(models, ep, { variant: key, band: readB.value, flourish: flourishRef });
}

async function writeOverlay(models, ep, style) {
  const { sequelize } = models;
  const families = await fontFamiliesReady();
  const { event, direction } = await sourceDirection(sequelize, ep.id);
  const flourishImage = style.flourish?.url ? await loadImage(style.flourish.url) : null;
  const png = renderTitleOverlay({
    title: ep.title, episodeNumber: ep.episode_number, direction, variant: style.variant, band: style.band,
    flourish: flourishImage, families,
  });
  const url = await uploadPng(png, `overlays/episode-title-text/${ep.id}/${crypto.randomUUID()}.png`);
  const assetId = crypto.randomUUID();
  const metadata = {
    source: 'episode-title-overlay',
    episode_title: ep.title,
    episode_number: ep.episode_number,
    event_id: event ? event.id : null,
    theme: direction ? direction.theme : null,
    style,
    fonts: families,
    transparent: true,
    width: WIDTH,
    height: HEIGHT,
    replaces_asset_id: ep.title_overlay_asset_id || null,
  };
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
       VALUES (:id, :name, 'UI_OVERLAY', :role, 'EPISODE', 'EPISODE', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
      { replacements: {
        id: assetId, name: `${ep.title} — Title Overlay`, role: TITLE_OVERLAY_ROLE, url,
        showId: ep.show_id, episodeId: ep.id, metadata: JSON.stringify(metadata),
      }, transaction }
    );
    const [old] = await sequelize.query(
      `UPDATE assets SET deleted_at = NOW(), updated_at = NOW()
        WHERE episode_id = :episodeId AND asset_role = :role AND deleted_at IS NULL AND id <> :assetId
        RETURNING id`,
      { replacements: { episodeId: ep.id, role: TITLE_OVERLAY_ROLE, assetId }, transaction }
    );
    // The replaced overlay leaves the timeline with it.
    const replaced = (old || []).map((r) => r.id);
    const [[reg]] = await sequelize.query(
      "SELECT to_regclass('public.timeline_placements') IS NOT NULL AS present",
      { transaction }
    );
    if (replaced.length > 0 && reg?.present) {
      await sequelize.query(
        `UPDATE timeline_placements SET deleted_at = NOW(), updated_at = NOW()
          WHERE episode_id = :episodeId AND asset_id IN (:replaced) AND deleted_at IS NULL`,
        { replacements: { episodeId: ep.id, replaced }, transaction }
      );
    }
    await sequelize.query(
      `UPDATE episodes SET title_overlay_asset_id = :assetId, title_overlay_title = :title,
              title_overlay_style = :style, updated_at = NOW()
        WHERE id = :episodeId`,
      { replacements: { assetId, title: ep.title, style: JSON.stringify(style), episodeId: ep.id }, transaction }
    );
  });
  const { placeOverlayOnBeat } = require('./episodeBeatPlacement');
  try {
    await placeOverlayOnBeat(models, {
      episodeId: ep.id,
      assetId,
      canonicalBeat: TITLE_OVERLAY_BEAT,
      label: 'Title Overlay',
      kind: 'title_overlay',
      source: 'episode-title-overlay',
      duration: 5,
      zIndex: 30,
      logTag: '[TitleOverlay]',
    });
  } catch (err) {
    // The overlay is saved; a failed placement is added by hand from the
    // timeline, so it does not undo the save.
    console.error('[TitleOverlay] placing the overlay on the opening beat failed:', err.message);
  }

  const after = await loadEpisode(sequelize, ep.id);
  return titleOverlayState(after, { s3_url_processed: url });
}

/**
 * The optional AI flourish (the one image cost, shown before as
 * flourish_estimate): an ornament in gold on black, keyed to transparency
 * and drawn behind the letters of the current overlay. Budget refusals from
 * the image service propagate (429).
 */
async function addTitleFlourish(models, episodeId) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) throw new TitleOverlayError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  requireApproved(ep);
  if (!ep.title_overlay_asset_id) {
    throw new TitleOverlayError('Choose a lettering style and save the title overlay first.', 409, 'NO_TITLE_OVERLAY');
  }
  const { direction } = await sourceDirection(sequelize, episodeId);
  const look = overlayLook(direction);
  const metal = look.finish === 'rose_foil' ? 'rose gold' : look.finish === 'sage' ? 'soft sage and gold' : 'gold';
  const prompt = [
    `A single symmetrical decorative ${metal} flourish ornament, fine filigree scrollwork, centered,`,
    'on a pure solid black background. No text, no letters, no frame, no people. Flat, crisp, high contrast.',
  ].join(' ');
  const imageUrl = await imageGen.generateImageUrl(prompt, FLOURISH_OPTIONS);
  if (!imageUrl) throw new TitleOverlayError('Image generation did not return an image.', 502, 'IMAGE_EMPTY');
  const axios = require('axios');
  const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const url = await uploadPng(Buffer.from(res.data), `overlays/episode-title-flourish/${episodeId}/${crypto.randomUUID()}.png`);
  const flourishId = crypto.randomUUID();
  await sequelize.query(
    `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
       s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
     VALUES (:id, :name, 'UI_OVERLAY', :role, 'EPISODE', 'EPISODE', 'MAIN', 'overlay', 'prop',
       :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
    { replacements: {
      id: flourishId, name: `${ep.title} — Title Flourish`, role: FLOURISH_ROLE, url, showId: ep.show_id, episodeId,
      metadata: JSON.stringify({ source: 'episode-title-flourish', prompt, options: FLOURISH_OPTIONS }),
    } }
  );
  const previous = parseJson(ep.title_overlay_style, {}) || {};
  return writeOverlay(models, ep, {
    variant: previous.variant || 'classic',
    band: previous.band || { enabled: false, opacity: BAND_DEFAULT },
    flourish: { asset_id: flourishId, url },
  });
}

/** The current overlay's state, for the title card panel. */
async function getTitleOverlayState(models, episodeId) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) return null;
  if (!ep.title_overlay_asset_id) return null;
  const [asset] = await sequelize.query(
    'SELECT id, s3_url_processed, s3_url_raw FROM assets WHERE id = :id AND deleted_at IS NULL LIMIT 1',
    { replacements: { id: ep.title_overlay_asset_id }, type: sequelize.QueryTypes.SELECT }
  );
  return titleOverlayState(ep, asset || null);
}

/**
 * Change the overlay's words (Evoni, 2026-10-07: "i need to be able to
 * edit/delete episode title" — the Title overlay). The overlay is set from
 * the episode's approved title, so its words are the title: the new words
 * become the episode's title, approved, and an existing overlay is redrawn
 * in the same lettering, band and flourish, at no image cost.
 * @returns the title card state (GET /:id/title-card's shape)
 */
async function setTitleWords(models, episodeId, words) {
  const { sequelize } = models;
  const title = typeof words === 'string' ? words.replace(/\s+/g, ' ').trim() : '';
  if (!title) throw new TitleOverlayError('Type the words for the title.', 400, 'TITLE_EMPTY');
  if (title.length > 255) throw new TitleOverlayError('The title is too long (255 characters at most).', 400, 'TITLE_TOO_LONG');
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) throw new TitleOverlayError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  await sequelize.query(
    `UPDATE episodes SET title = :title, updated_at = NOW() WHERE id = :episodeId AND deleted_at IS NULL`,
    { replacements: { title, episodeId } }
  );
  const { approveTitle, getTitleCardState } = require('./episodeTitleCardService');
  await approveTitle(models, episodeId, { expectedTitle: title });
  if (ep.title_overlay_asset_id) await saveTitleOverlay(models, episodeId, {});
  return getTitleCardState(models, episodeId);
}

/**
 * Delete the title overlay: its image and flourish leave the episode and the
 * timeline, and the episode no longer has one. The title itself stays.
 * @returns {{ deleted: number }} how many images were removed
 */
async function deleteTitleOverlay(models, episodeId) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) throw new TitleOverlayError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  return sequelize.transaction(async (transaction) => {
    const [gone] = await sequelize.query(
      `UPDATE assets SET deleted_at = NOW(), updated_at = NOW()
        WHERE episode_id = :episodeId AND asset_role IN (:roles) AND deleted_at IS NULL
        RETURNING id`,
      { replacements: { episodeId, roles: [TITLE_OVERLAY_ROLE, FLOURISH_ROLE] }, transaction }
    );
    const ids = (gone || []).map((r) => r.id);
    const [[reg]] = await sequelize.query(
      "SELECT to_regclass('public.timeline_placements') IS NOT NULL AS present",
      { transaction }
    );
    if (ids.length > 0 && reg?.present) {
      await sequelize.query(
        `UPDATE timeline_placements SET deleted_at = NOW(), updated_at = NOW()
          WHERE episode_id = :episodeId AND asset_id IN (:ids) AND deleted_at IS NULL`,
        { replacements: { episodeId, ids }, transaction }
      );
    }
    await sequelize.query(
      `UPDATE episodes SET title_overlay_asset_id = NULL, title_overlay_title = NULL, title_overlay_style = NULL,
              updated_at = NOW()
        WHERE id = :episodeId`,
      { replacements: { episodeId }, transaction }
    );
    return { deleted: ids.length };
  });
}

module.exports = {
  setTitleWords,
  deleteTitleOverlay,
  TITLE_OVERLAY_ROLE,
  TITLE_OVERLAY_BEAT,
  FLOURISH_ROLE,
  FLOURISH_OPTIONS,
  VARIANTS,
  VARIANT_KEYS,
  FINISHES,
  THEME_FINISH,
  BAND_MIN,
  BAND_MAX,
  BAND_DEFAULT,
  TitleOverlayError,
  colourOf,
  overlayLook,
  readBand,
  keyByBrightness,
  renderTitleOverlay,
  titleOverlayState,
  flourishEstimate,
  getTitleOverlayVariants,
  saveTitleOverlay,
  addTitleFlourish,
  getTitleOverlayState,
};
