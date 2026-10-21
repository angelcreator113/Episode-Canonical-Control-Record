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
 * Saving makes it the episode's primary thumbnail (thumbnails table) and
 * episodes.thumbnail_url; the one before it stays, as a cover. This page is
 * the one place an episode's thumbnail is edited (Evoni, 2026-10-20), so the
 * saved ones are listed here too: make one the episode's thumbnail again, or
 * delete one that is not.
 */

const sharp = require('sharp');
const layers = require('./thumbnailLayers');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const WIDTH = 1280;
const HEIGHT = 720;
const LAYOUTS = Object.freeze(['lala-left', 'lala-right', 'center']);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const { ASSET_BUCKET: BUCKET, requireAssetBucket } = require('./assetBucket');
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
    // JustAWoman, beside Lala (an episode's pose; not part of the show's style).
    jawUrl: typeof b.jawUrl === 'string' && b.jawUrl ? b.jawUrl : null,
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

/**
 * Where the figures stand when JustAWoman is beside Lala: both in Lala's
 * column, JustAWoman toward the edge and a little smaller, Lala in front.
 * Returns { lala, jaw } as { left, top } for figures of these sizes.
 */
function duoPositions(side, lalaSize, jawSize) {
  const edge = 20;
  const lalaCenter = 390; // from the figure side's edge
  const jaw = { left: edge, top: HEIGHT - jawSize.height };
  const lala = { left: Math.max(edge, lalaCenter - Math.round(lalaSize.width / 2)), top: HEIGHT - lalaSize.height };
  if (side === 'right') {
    jaw.left = WIDTH - edge - jawSize.width;
    lala.left = Math.min(WIDTH - edge - lalaSize.width, WIDTH - lalaCenter - Math.round(lalaSize.width / 2));
  }
  return { lala, jaw };
}

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
 * Renders the thumbnail: PNG, 1280×720. images: { background, lala, jaw }
 * as Buffers (any may be null). With Lala and JustAWoman both, they stand
 * together on the figure side (duoPositions); with one, she stands alone.
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
  const figure = async (buffer, who, size) => {
    try {
      const png = await sharp(buffer).rotate().resize({ ...size, fit: 'inside' }).png().toBuffer();
      const meta = await sharp(png).metadata();
      return { png, width: meta.width, height: meta.height };
    } catch (err) {
      console.error(`[YouTubeThumbnail] ${who} image unreadable:`, err.message);
      throw new ThumbnailError(400, `The ${who} image is not an image we can read`);
    }
  };
  if (box && images.lala && images.jaw) {
    const jaw = await figure(images.jaw, 'JustAWoman', { width: 340, height: HEIGHT - 80 });
    const lala = await figure(images.lala, 'Lala', { width: 360, height: HEIGHT - 30 });
    const at = duoPositions(box.side, lala, jaw);
    layers.push({ input: jaw.png, top: at.jaw.top, left: at.jaw.left });
    layers.push({ input: lala.png, top: at.lala.top, left: at.lala.left });
  } else if (box && (images.lala || images.jaw)) {
    const who = images.lala ? 'Lala' : 'JustAWoman';
    const one = await figure(images.lala || images.jaw, who, { width: box.maxWidth, height: HEIGHT - 30 });
    const left = box.side === 'left' ? 30 : WIDTH - one.width - 30;
    layers.push({ input: one.png, top: HEIGHT - one.height, left: Math.max(0, left) });
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
          -- The shopping-list paper (eventDocumentOverlayService) is a PNG too, not a cut-out.
          AND asset_type IS DISTINCT FROM 'DOCUMENT_OVERLAY'
        ORDER BY (asset_group = 'LALA' OR character_name ILIKE '%lala%') DESC NULLS LAST, created_at DESC
        LIMIT 40`,
      { replacements: { showId: episode.show_id } })
    : [[]];
  const poses = await readyPoses(sequelize, episode.id);
  const library = episode.show_id ? await libraryImages(sequelize, episode.show_id) : [];
  const outfit = await outfitImages(sequelize, episode.id);
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
    poses,
    folders: pictureFolders({ angles, cover: show?.cover_image_url, poses, outfit, library }),
    // The layers: the show's template (null until one is saved) and this episode's draft.
    template: readTemplate(show?.metadata?.youtube_thumbnail?.template),
    draft: await getDraft(sequelize, episode.id),
  };
}

// ── The pictures in folders (Evoni, 2026-10-21: "put them in folders") ──────

const ASSET_GROUP_LABEL = { LALA: 'Lala', SHOW: 'Show', GUEST: 'Guests', EPISODE: 'Episodes', WARDROBE: 'Wardrobe' };
const IMAGE_FILE = /\.(png|jpe?g|webp|avif)(\?|$)/i;

const folderKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'other';
const titleCase = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/** Groups items into folders by a label, in first-seen order. */
function groupInto(prefix, items, labelOf) {
  const out = new Map();
  for (const it of items) {
    const label = labelOf(it);
    const key = `${prefix}/${folderKey(label)}`;
    if (!out.has(key)) out.set(key, { key, label, items: [] });
    out.get(key).items.push(it);
  }
  return [...out.values()];
}

/** A folder with nothing in it, at any depth, is left out. */
function prune(folder) {
  const folders = (folder.folders || []).map(prune).filter(Boolean);
  const items = folder.items || [];
  if (!folders.length && !items.length) return null;
  return { key: folder.key, label: folder.label, ...(folders.length ? { folders } : {}), ...(items.length ? { items } : {}) };
}

/**
 * Every picture the Studio offers, in folders by where it comes from:
 *   Scene sets: one folder per set (its angles), and Show (the cover).
 *   Character poses: Lala and JustAWoman, then Front, Back, Side, Glamour.
 *   This episode's outfit: by clothing category.
 *   Asset library: by asset group (Lala, Show, Guests, Episodes, Wardrobe).
 *   Documents: the event documents drawn as pictures (the shopping list).
 * Each folder is { key, label, folders?, items? }; each item { url, label }.
 * Empty folders are left out; only S3/CloudFront pictures are kept.
 */
function pictureFolders({ angles = [], cover = null, poses = { lala: [], justawoman: [] }, outfit = [], library = [] }) {
  const ok = (it) => it && allowedImageUrl(it.url);
  const sets = groupInto('scene-sets', (angles || []).map((a) => ({ url: a.url, label: a.angle || a.set_name || 'Angle', set: a.set_name || 'Scene set' })).filter(ok), (a) => a.set)
    .map((f) => ({ ...f, items: f.items.map(({ url, label }) => ({ url, label })) }));
  const character = (key, label) => ({
    key: `poses/${key}`,
    label,
    folders: POSE_ORDER.map((p) => ({
      key: `poses/${key}/${p}`, label: POSE_LABEL[p],
      items: (poses[key] || []).filter((x) => x.pose === p).map((x) => ({ url: x.url, label: x.label, isDefault: x.isDefault })),
    })),
  });
  const docs = library.filter((a) => a.asset_type === 'DOCUMENT_OVERLAY');
  const assets = library.filter((a) => a.asset_type !== 'DOCUMENT_OVERLAY');
  const tree = [
    { key: 'scene-sets', label: 'Scene sets', folders: [...sets, { key: 'scene-sets/show', label: 'Show', items: [{ url: cover, label: 'Show cover' }].filter(ok) }] },
    { key: 'poses', label: 'Character poses', folders: [character('lala', 'Lala'), character('justawoman', 'JustAWoman')] },
    { key: 'outfit', label: "This episode's outfit", folders: groupInto('outfit', outfit.filter(ok), (w) => titleCase(w.category) || 'Other').map((f) => ({ ...f, items: f.items.map(({ url, label }) => ({ url, label })) })) },
    { key: 'library', label: 'Asset library', folders: groupInto('library', assets.filter(ok), (a) => ASSET_GROUP_LABEL[a.asset_group] || 'Other').map((f) => ({ ...f, items: f.items.map(({ url, label }) => ({ url, label })) })) },
    { key: 'documents', label: 'Documents', items: docs.filter(ok).map(({ url, label }) => ({ url, label })) },
  ];
  return tree.map(prune).filter(Boolean);
}

/** The show's pictures in the Asset library (newest first, at most 200): { url, label, asset_group, asset_type }. */
async function libraryImages(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT name, asset_group, asset_type, COALESCE(s3_url_processed, s3_url_raw) AS url
       FROM assets
      WHERE show_id = :showId AND deleted_at IS NULL AND COALESCE(s3_url_processed, s3_url_raw) IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 200`,
    { replacements: { showId } });
  return (rows || []).filter((r) => IMAGE_FILE.test(r.url || ''))
    .map((r) => ({ url: r.url, label: r.name || 'Picture', asset_group: r.asset_group, asset_type: r.asset_type }));
}

/**
 * The episode's approved outfit pieces (episode_wardrobe, as
 * GET /wardrobe/outfit/:episode_id reads it, attachment pieces too): the
 * background-removed picture when there is one. { url, label, category }.
 * Empty until the table exists.
 */
async function outfitImages(sequelize, episodeId) {
  const [[reg]] = await sequelize.query("SELECT to_regclass('public.episode_wardrobe') AS reg");
  if (!reg || !reg.reg) return [];
  const [rows] = await sequelize.query(
    `SELECT w.name, w.clothing_category AS category, COALESCE(w.s3_url_processed, w.s3_url, w.thumbnail_url) AS url
       FROM episode_wardrobe ew
       JOIN wardrobe w ON (w.id = ew.wardrobe_id OR w.parent_item_id = ew.wardrobe_id) AND w.deleted_at IS NULL
      WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL AND ew.approval_status = 'approved'
      ORDER BY ew.created_at ASC, w.parent_item_id NULLS FIRST
      LIMIT 60`,
    { replacements: { episodeId } });
  const seen = new Set();
  return (rows || []).filter((r) => r.url && !seen.has(r.url) && seen.add(r.url))
    .map((r) => ({ url: r.url, label: r.name || 'Piece', category: r.category }));
}

const POSE_ORDER = ['front', 'back', 'side', 'glamour'];
const POSE_LABEL = { front: 'Front', back: 'Back', side: 'Side', glamour: 'Glamour' };

/**
 * The episode's ready cut-outs from Files › Character poses
 * (episode_character_poses), as { lala: [...], justawoman: [...] }: each
 * { id, url, pose, label, isDefault }, by pose (Front, Back, Side, Glamour),
 * the default first. Empty lists when the table is not there yet (its
 * migration, 20261020150000, runs only through the Deploy workflow).
 */
async function readyPoses(sequelize, episodeId) {
  const out = { lala: [], justawoman: [] };
  const [[reg]] = await sequelize.query("SELECT to_regclass('public.episode_character_poses') AS reg");
  if (!reg || !reg.reg) return out;
  const [rows] = await sequelize.query(
    `SELECT id, character_key, pose, is_default, final_url AS url
       FROM episode_character_poses
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND status = 'ready' AND final_url IS NOT NULL
      ORDER BY array_position(ARRAY['front', 'back', 'side', 'glamour']::varchar[], pose::varchar), is_default DESC, created_at DESC
      LIMIT 80`,
    { replacements: { episodeId } });
  for (const r of rows || []) {
    if (!out[r.character_key] || !POSE_ORDER.includes(r.pose) || !allowedImageUrl(r.url)) continue;
    out[r.character_key].push({ id: r.id, url: r.url, pose: r.pose, label: `${POSE_LABEL[r.pose]}${r.is_default ? ' ★' : ''}`, isDefault: Boolean(r.is_default) });
  }
  return out;
}

/**
 * The show's thumbnail template (shows.metadata.youtube_thumbnail.template):
 * the layers every episode starts from (Evoni, 2026-10-21), or null when
 * none is saved or it no longer reads.
 */
function readTemplate(raw) {
  if (!raw) return null;
  try {
    return layers.readLayers(raw, allowedImageUrl);
  } catch (err) {
    console.error('[YouTubeThumbnail] the show\'s template does not read; ignoring it:', err.message);
    return null;
  }
}

/**
 * Saves the show's style (merged into shows.metadata.youtube_thumbnail).
 * body.template, when given, is the layers every episode starts from
 * (checked like any thumbnail); null clears it; left out, the saved one is
 * kept (the merge leaves keys the style does not name).
 */
async function saveStyle(sequelize, showId, body = {}) {
  const style = readStyle(body);
  if (style.lalaUrl && !allowedImageUrl(style.lalaUrl)) throw new ThumbnailError(400, 'The Lala image must be one of ours');
  if (body && body.template !== undefined) {
    style.template = body.template === null ? null : layers.readLayers(body.template, allowedImageUrl);
  }
  const [rows] = await sequelize.query(
    `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{youtube_thumbnail}',
        COALESCE(metadata::jsonb -> 'youtube_thumbnail', '{}'::jsonb) || CAST(:style AS jsonb), true), updated_at = NOW()
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
  await getS3().send(new PutObjectCommand({ Bucket: requireAssetBucket(), Key: key, Body: png, ContentType: 'image/png' }));
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
       VALUES (:episodeId, :bucket, :key, :size, 'image/png', ${WIDTH}, ${HEIGHT}, 'thumbnail', 'primary', NOW())
       RETURNING id`,
      { replacements: { episodeId, bucket: BUCKET, key, size: png.length }, transaction });
    await sequelize.query('UPDATE episodes SET thumbnail_url = :url WHERE id = :episodeId',
      { replacements: { episodeId, url }, transaction });
    return created;
  });
  return { id: row?.id, url, key };
}

/** The pictures a thumbnail's visible image layers use, fetched: { [layerId]: Buffer }. */
async function layerPictures(spec) {
  const out = {};
  await Promise.all(spec.layers.filter((l) => l.kind === 'image' && l.visible && l.src).map(async (l) => {
    out[l.id] = await fetchImage(l.src);
  }));
  return out;
}

/** Renders a layered thumbnail ({ version: 2, layers }, already read): PNG, 1280×720. */
async function renderSpec(spec) {
  return layers.renderLayers(spec, await layerPictures(spec));
}

const draftsReady = async (sequelize) => {
  const [[reg]] = await sequelize.query("SELECT to_regclass('public.episode_thumbnail_drafts') AS reg");
  return Boolean(reg && reg.reg);
};

/** The episode's thumbnail as last arranged ({ version: 2, layers }), or null. */
async function getDraft(sequelize, episodeId) {
  if (!await draftsReady(sequelize)) return null;
  const [[row]] = await sequelize.query(
    'SELECT spec, updated_at FROM episode_thumbnail_drafts WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId } });
  if (!row) return null;
  try {
    return { ...layers.readLayers(row.spec, allowedImageUrl), savedAt: row.updated_at };
  } catch (err) {
    console.error(`[YouTubeThumbnail] the draft of episode ${episodeId} does not read; ignoring it:`, err.message);
    return null;
  }
}

/** Keeps the episode's arrangement (one live draft per episode). 503 until its table exists. */
async function saveDraft(sequelize, episodeId, body, userId = null) {
  const spec = layers.readLayers(body, allowedImageUrl);
  if (!await draftsReady(sequelize)) throw new ThumbnailError(503, 'Saving arrangements needs the latest database update (episode_thumbnail_drafts)');
  const [[episode]] = await sequelize.query('SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1', { replacements: { episodeId } });
  if (!episode) throw new ThumbnailError(404, 'Episode not found');
  await sequelize.query(
    `INSERT INTO episode_thumbnail_drafts (episode_id, spec, updated_by)
     VALUES (:episodeId, CAST(:spec AS jsonb), :userId)
     ON CONFLICT (episode_id) WHERE deleted_at IS NULL
     DO UPDATE SET spec = EXCLUDED.spec, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    { replacements: { episodeId, spec: JSON.stringify(spec), userId } });
  return spec;
}

const PICTURE_FORMATS = { jpeg: ['jpg', 'image/jpeg'], png: ['png', 'image/png'], webp: ['webp', 'image/webp'], avif: ['avif', 'image/avif'] };

/**
 * Keeps a picture uploaded in the Studio (S3, under the episode), so a
 * layer can point at it and an arrangement can be saved. { url, label }.
 */
async function uploadPicture(episodeId, buffer, name = 'Upload') {
  let format;
  try {
    ({ format } = await sharp(buffer).metadata());
  } catch (err) {
    console.error('[YouTubeThumbnail] uploaded picture unreadable:', err.message);
    throw new ThumbnailError(400, 'That file is not a picture we can read. Use JPG, PNG or WebP.');
  }
  const [ext, contentType] = PICTURE_FORMATS[format] || [];
  if (!ext) throw new ThumbnailError(400, 'Use a JPG, PNG or WebP picture.');
  const key = `episodes/${episodeId}/thumbnail-pictures/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await getS3().send(new PutObjectCommand({ Bucket: requireAssetBucket(), Key: key, Body: buffer, ContentType: contentType }));
  return { url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`, label: String(name || 'Upload').slice(0, 80) };
}

const rowUrl = (r) => r.url || `https://${r.s3Bucket}.s3.${REGION}.amazonaws.com/${r.s3Key}`;

/** The episode's saved thumbnails, its current one first, then newest first. */
async function listSaved(sequelize, episodeId) {
  const [rows] = await sequelize.query(
    `SELECT id, "s3Bucket", "s3Key", url, "thumbnailType", "widthPixels", "heightPixels", "generatedAt"
       FROM thumbnails
      WHERE "episodeId" = :episodeId
      ORDER BY ("thumbnailType" = 'primary') DESC, "generatedAt" DESC NULLS LAST, id DESC
      LIMIT 100`,
    { replacements: { episodeId } });
  return (rows || []).map((r) => ({
    id: r.id,
    url: rowUrl(r),
    isPrimary: r.thumbnailType === 'primary',
    width: r.widthPixels,
    height: r.heightPixels,
    savedAt: r.generatedAt,
  }));
}

async function findSaved(sequelize, episodeId, thumbnailId, transaction) {
  const [[row]] = await sequelize.query(
    `SELECT id, "s3Bucket", "s3Key", url, "thumbnailType" FROM thumbnails
      WHERE id = :thumbnailId AND "episodeId" = :episodeId LIMIT 1`,
    { replacements: { episodeId, thumbnailId }, transaction });
  if (!row) throw new ThumbnailError(404, 'That thumbnail is not one of this episode\'s');
  return row;
}

/** Makes a saved thumbnail the episode's thumbnail again; the current one becomes a cover. */
async function makePrimary(sequelize, episodeId, thumbnailId) {
  if (!/^\d+$/.test(String(thumbnailId))) throw new ThumbnailError(400, 'Unknown thumbnail');
  return sequelize.transaction(async (transaction) => {
    const row = await findSaved(sequelize, episodeId, thumbnailId, transaction);
    const url = rowUrl(row);
    await sequelize.query(
      `UPDATE thumbnails SET "thumbnailType" = 'cover'
        WHERE "episodeId" = :episodeId AND "thumbnailType" = 'primary' AND id <> :thumbnailId`,
      { replacements: { episodeId, thumbnailId }, transaction });
    await sequelize.query(
      `UPDATE thumbnails SET "thumbnailType" = 'primary' WHERE id = :thumbnailId`,
      { replacements: { thumbnailId }, transaction });
    await sequelize.query('UPDATE episodes SET thumbnail_url = :url WHERE id = :episodeId',
      { replacements: { episodeId, url }, transaction });
    return { id: row.id, url };
  });
}

/**
 * Deletes a saved thumbnail that is not the episode's current one (its row;
 * the S3 file stays). The current one is refused: make another current first.
 */
async function removeSaved(sequelize, episodeId, thumbnailId) {
  if (!/^\d+$/.test(String(thumbnailId))) throw new ThumbnailError(400, 'Unknown thumbnail');
  const row = await findSaved(sequelize, episodeId, thumbnailId);
  if (row.thumbnailType === 'primary') {
    throw new ThumbnailError(409, 'This is the episode\'s thumbnail. Make another one the thumbnail first.');
  }
  await sequelize.query('DELETE FROM thumbnails WHERE id = :thumbnailId AND "episodeId" = :episodeId',
    { replacements: { episodeId, thumbnailId } });
  return { id: row.id };
}

module.exports = {
  WIDTH, HEIGHT, LAYOUTS, DEFAULT_STYLE, ThumbnailError,
  readStyle, readSpec, allowedImageUrl, fetchImage, layoutBoxes, duoPositions, readyPoses, pictureFolders, libraryImages, outfitImages, titleSize, wrapTitle, fitTitle, kickerSize, textSvg, shadeSvg,
  render, sources, saveStyle, saveAsPrimary, listSaved, makePrimary, removeSaved,
  readTemplate, renderSpec, getDraft, saveDraft, uploadPicture,
};
