'use strict';

/**
 * YouTube thumbnails (Templates › YouTube thumbnails; Evoni, 2026-10-17):
 * an episode's 1280×720 thumbnail made from its show's style. The style
 * (layout, colours, the Lala cut-out, how dark the background is) is saved
 * once on the show (shows.metadata.youtube_thumbnail) and each episode
 * fills in its own picture, title and episode number.
 *
 * Rendered here with sharp, so the preview is the saved file: the
 * background (cover-fit), a gradient for the text side, the Lala cut-out
 * (bottom-aligned on one side), then the text as SVG (the show's name, the
 * title in up to three lines, the episode badge). Images come from S3 only
 * (allowedImageUrl) or from the request's own upload.
 *
 * Saving makes it the episode's primary thumbnail (thumbnails table); the
 * one before it stays, as a cover.
 */

const sharp = require('sharp');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const WIDTH = 1280;
const HEIGHT = 720;
const LAYOUTS = Object.freeze(['lala-left', 'lala-right', 'center']);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const BUCKET = process.env.AWS_S3_BUCKET || process.env.S3_ASSET_BUCKET || 'primepisodes-assets';
const REGION = process.env.AWS_REGION || 'us-east-1';

const DEFAULT_STYLE = Object.freeze({
  layout: 'lala-left', accent: '#E0689F', textColor: '#FFFFFF', dim: 0.35, lalaUrl: null,
});

class ThumbnailError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const HEX = /^#[0-9a-f]{6}$/i;
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** The show's saved style, filled out with the defaults. */
function readStyle(raw = {}) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    layout: LAYOUTS.includes(s.layout) ? s.layout : DEFAULT_STYLE.layout,
    accent: HEX.test(s.accent || '') ? s.accent.toUpperCase() : DEFAULT_STYLE.accent,
    textColor: HEX.test(s.textColor || '') ? s.textColor.toUpperCase() : DEFAULT_STYLE.textColor,
    dim: Number.isFinite(Number(s.dim)) ? Math.min(0.8, Math.max(0, Number(s.dim))) : DEFAULT_STYLE.dim,
    lalaUrl: typeof s.lalaUrl === 'string' && s.lalaUrl ? s.lalaUrl : null,
  };
}

/** A render request: the style plus this episode's words and pictures. Throws ThumbnailError(400). */
function readSpec(body = {}) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.layout !== undefined && !LAYOUTS.includes(b.layout)) throw new ThumbnailError(400, `layout must be one of ${LAYOUTS.join(', ')}`);
  for (const k of ['accent', 'textColor']) {
    if (b[k] !== undefined && !HEX.test(String(b[k]))) throw new ThumbnailError(400, `${k} must be a colour like #E0689F`);
  }
  const style = readStyle(b);
  const title = clean(b.title, 90);
  if (!title) throw new ThumbnailError(400, 'The thumbnail needs a title');
  return {
    ...style,
    title,
    kicker: clean(b.kicker, 48),
    badge: clean(b.badge, 12),
    backgroundUrl: typeof b.backgroundUrl === 'string' && b.backgroundUrl ? b.backgroundUrl : null,
  };
}

/** Only https images in S3 (or the CloudFront domain) are fetched. */
function allowedImageUrl(url) {
  let u;
  try { u = new URL(String(url)); } catch (err) { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (process.env.CLOUDFRONT_DOMAIN && host === String(process.env.CLOUDFRONT_DOMAIN).toLowerCase()) return true;
  return /^[a-z0-9.-]+\.s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host);
}

async function fetchImage(url) {
  if (!allowedImageUrl(url)) throw new ThumbnailError(400, 'That image is not one of ours (only S3 images can be used)');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new ThumbnailError(400, `Could not read an image (${res.status})`);
    const len = Number(res.headers.get('content-length'));
    if (len && len > MAX_IMAGE_BYTES) throw new ThumbnailError(400, 'An image is too big (25 MB at most)');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw new ThumbnailError(400, 'An image is too big (25 MB at most)');
    return buf;
  } catch (err) {
    if (err instanceof ThumbnailError) throw err;
    console.error('[YouTubeThumbnail] image fetch failed:', err.message);
    throw new ThumbnailError(400, 'Could not read an image');
  } finally {
    clearTimeout(timer);
  }
}

// ── Layout and text ─────────────────────────────────────────────────────────

/** Where the text goes and where Lala stands, per layout. */
function layoutBoxes(layout) {
  if (layout === 'lala-right') return { text: { x: 70, width: 620, align: 'start' }, lala: { side: 'right', maxWidth: 560 } };
  if (layout === 'center') return { text: { x: 110, width: 1060, align: 'middle' }, lala: null };
  return { text: { x: 590, width: 610, align: 'start' }, lala: { side: 'left', maxWidth: 560 } };
}

/** The title's starting size: big for a few words, smaller for many. */
function titleSize(title, width) {
  const n = String(title || '').length;
  const base = n <= 14 ? 112 : n <= 26 ? 92 : n <= 44 ? 80 : 68;
  return width < 700 ? base : Math.round(base * 1.1);
}

const CHAR_EM = 0.56; // bold serif: a little over half an em a character

/** The title in lines that fit the width; more than three only when cut (with …). */
function wrapTitle(title, width, size, maxLines = 3) {
  const perLine = Math.max(6, Math.floor(width / (size * CHAR_EM)));
  const words = String(title || '').split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= perLine || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:!?-]*$/, '')}…`;
    return kept;
  }
  return lines;
}

/** The title's size and lines: the starting size, made smaller until it fits in three lines (54 at least). */
function fitTitle(title, width) {
  for (let size = titleSize(title, width); size > 54; size -= 6) {
    const lines = wrapTitle(title, width, size, Infinity);
    if (lines.length <= 3) return { size, lines };
  }
  return { size: 54, lines: wrapTitle(title, width, 54) };
}

/** The show's name sized to fit its column on one line (34 at most, 20 at least). */
function kickerSize(kicker, width) {
  const n = String(kicker || '').length || 1;
  return Math.max(20, Math.min(34, Math.floor(width / (n * 0.8 + 1))));
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The text layer as SVG: the show's name, the title, the episode badge. */
function textSvg(spec) {
  const box = layoutBoxes(spec.layout).text;
  const { size, lines } = fitTitle(spec.title, box.width);
  const kSize = kickerSize(spec.kicker, box.width);
  const lineH = Math.round(size * 1.05);
  const blockH = lines.length * lineH + (spec.kicker ? 64 : 0);
  let y = Math.round((HEIGHT - blockH) / 2) + (spec.kicker ? 64 : 0) + Math.round(size * 0.8);
  const x = box.align === 'middle' ? WIDTH / 2 : box.x;
  const anchor = box.align === 'middle' ? 'middle' : 'start';
  const kickerY = y - Math.round(size * 0.8) - 22;
  const parts = [];
  if (spec.kicker) {
    parts.push(`<text x="${x}" y="${kickerY}" text-anchor="${anchor}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${kSize}" font-weight="700" letter-spacing="${Math.round(kSize / 8)}" fill="${spec.accent}" stroke="#2A0A22" stroke-width="6" paint-order="stroke">${esc(spec.kicker.toUpperCase())}</text>`);
  }
  for (const l of lines) {
    parts.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Georgia, DejaVu Serif, serif" font-size="${size}" font-weight="700" fill="${spec.textColor}" stroke="#2A0A22" stroke-width="${Math.round(size / 9)}" stroke-linejoin="round" paint-order="stroke">${esc(l)}</text>`);
    y += lineH;
  }
  if (spec.badge) {
    const w = Math.max(120, 40 + spec.badge.length * 30);
    const bx = spec.layout === 'lala-right' ? 56 : WIDTH - w - 56;
    parts.push(`<rect x="${bx}" y="44" rx="34" ry="34" width="${w}" height="68" fill="${spec.accent}" stroke="#FFFFFF" stroke-width="4"/>`);
    parts.push(`<text x="${bx + w / 2}" y="91" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="36" font-weight="700" fill="#FFFFFF">${esc(spec.badge.toUpperCase())}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${parts.join('')}</svg>`;
}

/** The gradient that keeps the text side readable, plus an overall dim. */
function shadeSvg(spec) {
  const toward = spec.layout === 'lala-right' ? { x1: 0, x2: 1 } : spec.layout === 'center' ? null : { x1: 1, x2: 0 };
  const grad = toward
    ? `<linearGradient id="g" x1="${toward.x1}" y1="0" x2="${toward.x2}" y2="0"><stop offset="0" stop-color="#2A0A22" stop-opacity="0.85"/><stop offset="0.55" stop-color="#2A0A22" stop-opacity="0.35"/><stop offset="1" stop-color="#2A0A22" stop-opacity="0"/></linearGradient>`
    : '<radialGradient id="g" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="#2A0A22" stop-opacity="0.65"/><stop offset="1" stop-color="#2A0A22" stop-opacity="0.2"/></radialGradient>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs>${grad}</defs>`
    + `<rect width="${WIDTH}" height="${HEIGHT}" fill="#000" fill-opacity="${spec.dim}"/>`
    + `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>`
    + `<rect x="0" y="${HEIGHT - 14}" width="${WIDTH}" height="14" fill="${spec.accent}"/></svg>`;
}

const plainBackground = (accent) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A1640"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#b)"/></svg>`,
);

/**
 * Renders the thumbnail: PNG, 1280×720. images: { background, lala }
 * as Buffers (either may be null).
 */
async function render(spec, images = {}) {
  let base;
  try {
    base = images.background
      ? await sharp(images.background).rotate().resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' }).png().toBuffer()
      : await sharp(plainBackground(spec.accent)).png().toBuffer();
  } catch (err) {
    console.error('[YouTubeThumbnail] background unreadable:', err.message);
    throw new ThumbnailError(400, 'The background is not an image we can read');
  }
  const layers = [{ input: Buffer.from(shadeSvg(spec)), top: 0, left: 0 }];
  const box = layoutBoxes(spec.layout).lala;
  if (box && images.lala) {
    try {
      const lala = await sharp(images.lala).rotate().resize({ width: box.maxWidth, height: HEIGHT - 30, fit: 'inside' }).png().toBuffer();
      const meta = await sharp(lala).metadata();
      const left = box.side === 'left' ? 30 : WIDTH - meta.width - 30;
      layers.push({ input: lala, top: HEIGHT - meta.height, left: Math.max(0, left) });
    } catch (err) {
      console.error('[YouTubeThumbnail] Lala image unreadable:', err.message);
      throw new ThumbnailError(400, 'The Lala image is not an image we can read');
    }
  }
  layers.push({ input: Buffer.from(textSvg(spec)), top: 0, left: 0 });
  return sharp(base).composite(layers).png({ compressionLevel: 9 }).toBuffer();
}

// ── Sources and saving ──────────────────────────────────────────────────────

/** The episode, its show, the pictures to choose from, and the show's saved style. */
async function sources(sequelize, episodeId) {
  const [[episode]] = await sequelize.query(
    `SELECT id, title, episode_number, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId } });
  if (!episode) throw new ThumbnailError(404, 'Episode not found');
  const [[show]] = episode.show_id
    ? await sequelize.query(
      'SELECT id, name, cover_image_url, metadata FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1',
      { replacements: { showId: episode.show_id } })
    : [[null]];
  const [angles] = await sequelize.query(
    `SELECT DISTINCT ON (a.still_image_url) a.still_image_url AS url, COALESCE(a.angle_name, a.angle_label) AS angle, s.name AS set_name
       FROM scene_plans p
       JOIN scene_sets s ON s.id = p.scene_set_id AND s.deleted_at IS NULL
       JOIN scene_angles a ON a.scene_set_id = s.id AND a.deleted_at IS NULL
      WHERE p.episode_id = :episodeId AND p.deleted_at IS NULL AND a.still_image_url IS NOT NULL
      LIMIT 40`,
    { replacements: { episodeId } });
  const [cutouts] = episode.show_id
    ? await sequelize.query(
      // Background-removed images are the processed PNGs (AssetService's
      // background removal); s3_url_no_bg is model-only, never migrated.
      `SELECT id, name, s3_url_processed AS url
         FROM assets
        WHERE show_id = :showId AND deleted_at IS NULL
          AND s3_url_processed ILIKE '%.png'
        ORDER BY (asset_group = 'LALA' OR character_name ILIKE '%lala%') DESC NULLS LAST, created_at DESC
        LIMIT 40`,
      { replacements: { showId: episode.show_id } })
    : [[]];
  const backgrounds = [
    ...(angles || []).map((a) => ({ url: a.url, label: [a.set_name, a.angle].filter(Boolean).join(' · ') })),
    ...(show?.cover_image_url ? [{ url: show.cover_image_url, label: 'Show cover' }] : []),
  ].filter((b) => allowedImageUrl(b.url));
  return {
    episode: { id: episode.id, title: episode.title, episode_number: episode.episode_number },
    show: show ? { id: show.id, name: show.name } : null,
    style: readStyle(show?.metadata?.youtube_thumbnail),
    backgrounds,
    cutouts: (cutouts || []).filter((c) => allowedImageUrl(c.url)).map((c) => ({ id: c.id, url: c.url, label: c.name })),
  };
}

/** Saves the show's style (merged into shows.metadata.youtube_thumbnail). */
async function saveStyle(sequelize, showId, body) {
  const style = readStyle(body);
  if (style.lalaUrl && !allowedImageUrl(style.lalaUrl)) throw new ThumbnailError(400, 'The Lala image must be one of ours');
  const [rows] = await sequelize.query(
    `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{youtube_thumbnail}', CAST(:style AS jsonb), true), updated_at = NOW()
      WHERE id = :showId AND deleted_at IS NULL RETURNING id`,
    { replacements: { showId, style: JSON.stringify(style) } });
  if (!(rows || []).length) throw new ThumbnailError(404, 'Show not found');
  return style;
}

let s3 = null;
const getS3 = () => {
  if (!s3) {
    const config = { region: REGION };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
    }
    s3 = new S3Client(config);
  }
  return s3;
};

/**
 * Uploads the PNG and makes it the episode's primary thumbnail; the one
 * before it becomes a cover. Returns { id, url, key }.
 */
async function saveAsPrimary(sequelize, episodeId, png) {
  const key = `episodes/${episodeId}/thumbnails/youtube-${Date.now()}.png`;
  await getS3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: png, ContentType: 'image/png' }));
  const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  // Only the columns the thumbnails migration creates (isPrimary and the
  // publish columns are model-only; scripts/schema-agreement-step2.baseline).
  const row = await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `UPDATE thumbnails SET "thumbnailType" = 'cover'
        WHERE "episodeId" = :episodeId AND "thumbnailType" = 'primary'`,
      { replacements: { episodeId }, transaction });
    const [[created]] = await sequelize.query(
      `INSERT INTO thumbnails ("episodeId", "s3Bucket", "s3Key", "fileSizeBytes", "mimeType", "widthPixels", "heightPixels", format, "thumbnailType", "generatedAt")
       VALUES (:episodeId, :bucket, :key, :size, 'image/png', ${WIDTH}, ${HEIGHT}, 'png', 'primary', NOW())
       RETURNING id`,
      { replacements: { episodeId, bucket: BUCKET, key, size: png.length }, transaction });
    return created;
  });
  return { id: row?.id, url, key };
}

module.exports = {
  WIDTH, HEIGHT, LAYOUTS, DEFAULT_STYLE, ThumbnailError,
  readStyle, readSpec, allowedImageUrl, fetchImage, layoutBoxes, titleSize, wrapTitle, fitTitle, kickerSize, textSvg, shadeSvg,
  render, sources, saveStyle, saveAsPrimary,
};
