'use strict';

/**
 * YouTube thumbnails (Templates › YouTube thumbnails; Evoni, 2026-10-17):
 * an episode's 1280×720 thumbnail. Since 2026-10-21 it is layers
 * (thumbnailLayers: moved, resized and turned freely), drawn here with
 * node-canvas, so "See it exactly" is the saved file. The show's style and
 * template (shows.metadata.youtube_thumbnail) are where every episode
 * starts; an episode's own arrangement is its draft
 * (episode_thumbnail_drafts). Pictures come from S3 only (allowedImageUrl);
 * a Studio upload is kept in S3 first.
 *
 * Saving makes it the episode's current thumbnail (episode_saved_thumbnails)
 * and episodes.thumbnail_url; the one before it stays in the list. This page is
 * the one place an episode's thumbnail is edited (Evoni, 2026-10-20), so the
 * saved ones are listed here too: make one the episode's thumbnail again, or
 * delete one that is not.
 */

const sharp = require('sharp');
const layers = require('./thumbnailLayers');
const archiver = require('archiver');
const { createCache } = require('./pictureCache');
const { readDocuments } = require('./eventDocumentsService');
const { readLogo } = require('./showLogoService');
const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
const { PutObjectCommand, ListObjectsV2Command, S3Client } = require('@aws-sdk/client-s3');

const WIDTH = 1280;
const HEIGHT = 720;
const LAYOUTS = Object.freeze(['lala-left', 'lala-right', 'center', 'come-style-me', 'checklist-focus', 'before-after']);
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

// A show's brand kit (Evoni, 2026-10-22): its own colours, fonts and stickers,
// offered first in the Studio. Kept beside the style, in the show's metadata.
const BRAND_COLOURS_MAX = 8;
const uniq = (xs) => [...new Set(xs)];

/** A brand kit, read and checked: up to eight colours (#RRGGBB), known fonts and stickers. */
function readBrand(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    colours: uniq(list(b.colours).filter((c) => typeof c === 'string' && HEX.test(c)).map((c) => c.toUpperCase())).slice(0, BRAND_COLOURS_MAX),
    fonts: uniq(list(b.fonts).filter((f) => typeof f === 'string' && Object.prototype.hasOwnProperty.call(layers.FONTS, f))),
    stickers: uniq(list(b.stickers).filter((k) => typeof k === 'string' && layers.SHAPES.includes(k))),
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

// Recent pictures, and the editor's smaller copies, for a few minutes (pictureCache).
const pictures = createCache();

/** A picture's bytes: from the cache when it was read lately, else fetched (and kept). */
async function fetchImage(url) {
  if (!allowedImageUrl(url)) throw new ThumbnailError(400, 'That image is not one of ours (only S3 images can be used)');
  return pictures.get(`full:${url}`, () => downloadImage(url));
}

const PREVIEW_WIDTHS = [400, 800, 1600];

/**
 * A smaller copy of a picture for the editor (Evoni, 2026-10-21: make it
 * faster): at most `width` wide (rounded up to 400, 800 or 1600), WebP,
 * transparency kept. The saved thumbnail is still drawn from the full one.
 */
async function previewImage(url, width = 800) {
  const w = PREVIEW_WIDTHS.find((x) => x >= Number(width)) || PREVIEW_WIDTHS[PREVIEW_WIDTHS.length - 1];
  const full = await fetchImage(url);
  return pictures.get(`preview:${w}:${url}`, async () => {
    try {
      return await sharp(full).rotate().resize({ width: w, height: w * 2, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    } catch (err) {
      console.error('[YouTubeThumbnail] preview could not be made:', err.message);
      throw new ThumbnailError(400, 'That is not a picture we can read');
    }
  });
}

async function downloadImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // No redirects: an address we allow must not lead somewhere we don't.
    const res = await fetch(url, { signal: controller.signal, redirect: 'error' });
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
    style: { ...readStyle(show?.metadata?.youtube_thumbnail), brand: readBrand(show?.metadata?.youtube_thumbnail?.brand) },
    backgrounds,
    cutouts: (cutouts || []).filter((c) => allowedImageUrl(c.url)).map((c) => ({ id: c.id, url: c.url, label: c.name })),
    poses,
    folders: pictureFolders({ angles, cover: show?.cover_image_url, poses, outfit, library, uploads: await listUploads(episode.id) }),
    // What the "Come Style Me" layout fills in (Evoni, 2026-10-21).
    suggest: await layoutSuggestions(sequelize, episode.id, outfit, show, episode.title),
    // The layers: the show's templates (named; Evoni, 2026-10-21), the
    // default one (where an episode starts; null until one is saved), and
    // this episode's draft.
    ...await templatesAndDefault(sequelize, show),
    draft: await getDraft(sequelize, episode.id),
    // Versions kept to compare (Evoni, 2026-10-21).
    versions: await listVersions(sequelize, episode.id),
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
 *   Uploads (first): the pictures uploaded in the Studio for the episode.
 * Each folder is { key, label, folders?, items? }; each item { url, label }.
 * Empty folders are left out; only S3/CloudFront pictures are kept.
 */
function pictureFolders({ angles = [], cover = null, poses = { lala: [], justawoman: [] }, outfit = [], library = [], uploads = [] }) {
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
    { key: 'uploads', label: 'Uploads', items: uploads.filter(ok).map(({ url, label }) => ({ url, label })) },
    { key: 'scene-sets', label: 'Scene sets', folders: [...sets, { key: 'scene-sets/show', label: 'Show', items: [{ url: cover, label: 'Show cover' }].filter(ok) }] },
    { key: 'poses', label: 'Character poses', folders: [character('lala', 'Lala'), character('justawoman', 'JustAWoman')] },
    { key: 'outfit', label: "This episode's outfit", folders: groupInto('outfit', outfit.filter(ok), (w) => titleCase(w.category) || 'Other').map((f) => ({ ...f, items: f.items.map(({ url, label }) => ({ url, label })) })) },
    { key: 'library', label: 'Asset library', folders: groupInto('library', assets.filter(ok), (a) => ASSET_GROUP_LABEL[a.asset_group] || 'Other').map((f) => ({ ...f, items: f.items.map(({ url, label }) => ({ url, label })) })) },
    { key: 'documents', label: 'Documents', items: docs.filter(ok).map(({ url, label }) => ({ url, label })) },
  ];
  return tree.map(prune).filter(Boolean);
}

const FALLBACK_CHECKLIST = ['Outfit', 'Accessories', 'Hair', 'Vibe'];

/**
 * What the "Come Style Me" layout fills in for an episode (Evoni,
 * 2026-10-21; all of it editable before saving):
 *   checklist: 3-4 rows, ticked; the main piece by its name ("Sweater
 *     dress"), the others by their kind. The slots of the episode's event's shopping
 *     list (the episode's event by the one rule, utils/episodeEventSql;
 *     "dress", "shoes", ...); else
 *     the outfit's categories with Hair and Vibe; else Outfit,
 *     Accessories, Hair, Vibe.
 *   edition: the episode's title (Evoni, 2026-10-21: "edition label
 *     should be the episode title"); without one, "<main piece> Edition"
 *     (the outfit's dress, else its first piece; else the event's theme),
 *     or null.
 *   pieces: up to four of the outfit's pictures, for the photo cards.
 *   logoUrl: the show's logo (showLogoService), or null.
 */
async function layoutSuggestions(sequelize, episodeId, outfit = [], show = null, title = null) {
  let event = null;
  try {
    const [[row]] = await sequelize.query(
      `SELECT theme, canon_consequences FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL} LIMIT 1`,
      { replacements: { episodeId } });
    event = row || null;
  } catch (err) {
    console.error('[YouTubeThumbnail] the episode\'s event did not read; no shopping list for the checklist:', err.message);
  }
  // The main piece by its name ("Sweater dress"), the rest by their kind ("Accessories").
  const mainKind = /dress|gown|top|jumpsuit|outfit|suit/i;
  const rowFor = (kind) => {
    const piece = mainKind.test(kind) && outfit.find((w) => String(w.category || '').toLowerCase() === String(kind).toLowerCase() && w.label);
    if (!piece) return titleCase(kind);
    const name = String(piece.label).trim().toLowerCase();
    return name[0].toUpperCase() + name.slice(1);
  };
  const slots = (readDocuments(event).shopping_list?.items || [])
    .map((it) => String(it?.slot || '').trim())
    .filter((s) => s && !/^item_\d+$/i.test(s))
    .map(rowFor);
  const fromOutfit = outfit.map((w) => w.category).filter(Boolean).map(rowFor);
  const pickRows = (list) => [...new Set(list)].slice(0, 4);
  let rows = pickRows(slots);
  if (rows.length < 3) rows = pickRows([...fromOutfit, 'Hair', 'Vibe']);
  if (rows.length < 3) rows = FALLBACK_CHECKLIST;
  const main = outfit.find((w) => /dress/i.test(w.category || '')) || outfit[0] || null;
  const named = String(title || '').trim();
  const edition = named || (main?.label ? `${titleCase(main.label)} Edition` : (event?.theme ? `${titleCase(event.theme)} Edition` : null));
  const logo = readLogo(show?.metadata);
  return {
    checklist: rows.map((text) => ({ text, checked: true })),
    edition: edition ? edition.slice(0, 160) : null,
    pieces: outfit.filter((w) => allowedImageUrl(w.url)).slice(0, 4).map(({ url, label }) => ({ url, label })),
    logoUrl: logo && allowedImageUrl(logo.url) ? logo.url : null,
  };
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

/** Keeps the show's brand kit, leaving the rest of its style as it is. */
async function saveBrand(sequelize, showId, body = {}) {
  const brand = readBrand(body);
  const [rows] = await sequelize.query(
    `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{youtube_thumbnail}',
        COALESCE(metadata::jsonb -> 'youtube_thumbnail', '{}'::jsonb) || jsonb_build_object('brand', CAST(:brand AS jsonb)), true), updated_at = NOW()
      WHERE id = :showId AND deleted_at IS NULL RETURNING id`,
    { replacements: { showId, brand: JSON.stringify(brand) } });
  if (!(rows || []).length) throw new ThumbnailError(404, 'Show not found');
  return brand;
}

// ── A show's named templates (Evoni, 2026-10-21: several per show, each
// with a picture, renamed at will; show_thumbnail_templates) ─────────────────

const TEMPLATE_NAME_MAX = 80;
const LEGACY_ID = 'legacy';
const PREVIEW_SIZE = { width: 640, height: 360 };

const templatesReady = async (sequelize) => {
  const [[reg]] = await sequelize.query("SELECT to_regclass('public.show_thumbnail_templates') AS reg");
  return Boolean(reg && reg.reg);
};

const requireTemplates = async (sequelize) => {
  if (!await templatesReady(sequelize)) {
    throw new ThumbnailError(503, 'Named templates need the latest database update (show_thumbnail_templates)');
  }
};

/** A template's name: trimmed, 1 to 80 characters. */
function templateName(raw) {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > TEMPLATE_NAME_MAX) throw new ThumbnailError(400, `A template needs a name of 1 to ${TEMPLATE_NAME_MAX} characters`);
  return name;
}

/** The template kept in the show's metadata before named ones, standing in as "Default" until one is saved. */
function legacyTemplate(show) {
  const spec = readTemplate(show?.metadata?.youtube_thumbnail?.template);
  return spec ? { id: LEGACY_ID, name: 'Default', isDefault: true, previewUrl: null, spec, updatedAt: null, legacy: true } : null;
}

const templateOut = (r) => ({
  id: r.id, name: r.name, isDefault: Boolean(r.is_default), previewUrl: r.preview_url || null,
  spec: readTemplate(r.spec), updatedAt: r.updated_at,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A template id from a request: "legacy" or a uuid; anything else is not one. */
const templateIdOf = (id) => {
  if (id === LEGACY_ID || UUID.test(String(id))) return id;
  throw new ThumbnailError(404, 'Template not found');
};

async function findShow(sequelize, showId, transaction) {
  if (!UUID.test(String(showId))) throw new ThumbnailError(404, 'Show not found');
  const [[show]] = await sequelize.query(
    'SELECT id, name, metadata FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1',
    { replacements: { showId }, transaction });
  if (!show) throw new ThumbnailError(404, 'Show not found');
  return show;
}

async function templateRows(sequelize, showId, transaction) {
  const [rows] = await sequelize.query(
    `SELECT id, name, spec, preview_url, is_default, updated_at FROM show_thumbnail_templates
      WHERE show_id = :showId AND deleted_at IS NULL
      ORDER BY is_default DESC, lower(name)`,
    { replacements: { showId }, transaction });
  return rows;
}

/** The show's templates, the default first; the metadata one stands in until one is saved. */
async function listTemplates(sequelize, showOrId) {
  const show = typeof showOrId === 'object' ? showOrId : await findShow(sequelize, showOrId);
  if (!show) return [];
  const rows = await templatesReady(sequelize) ? await templateRows(sequelize, show.id) : [];
  if (rows.length) return rows.map(templateOut);
  const legacy = legacyTemplate(show);
  return legacy ? [legacy] : [];
}

/** For sources: the show's templates and the default's layers (where an episode starts). */
async function templatesAndDefault(sequelize, show) {
  const templates = await listTemplates(sequelize, show);
  const def = templates.find((t) => t.isDefault) || null;
  return { templates, template: def?.spec || null };
}

/** Every show's templates, for the Templates page (no layers; their pictures). */
async function listAllTemplates(sequelize) {
  const [shows] = await sequelize.query('SELECT id, name, metadata FROM shows WHERE deleted_at IS NULL ORDER BY name');
  const ready = await templatesReady(sequelize);
  const [rows] = ready
    ? await sequelize.query(
      `SELECT id, show_id, name, preview_url, is_default, updated_at FROM show_thumbnail_templates
        WHERE deleted_at IS NULL ORDER BY is_default DESC, lower(name)`)
    : [[]];
  return shows.map((show) => {
    const own = rows.filter((r) => r.show_id === show.id)
      .map((r) => ({ id: r.id, name: r.name, isDefault: Boolean(r.is_default), previewUrl: r.preview_url || null, updatedAt: r.updated_at }));
    const legacy = own.length ? null : legacyTemplate(show);
    const templates = legacy ? [{ ...legacy, spec: undefined }] : own;
    return { show: { id: show.id, name: show.name }, templates };
  }).filter((g) => g.templates.length);
}

/** A small picture of some layers (640×360 JPEG in S3, under prefix), or null when it cannot be drawn. */
async function drawLayersPreview(prefix, id, spec) {
  try {
    const png = await renderSpec(spec);
    const jpg = await sharp(png).resize(PREVIEW_SIZE.width, PREVIEW_SIZE.height).jpeg({ quality: 82 }).toBuffer();
    const key = `${prefix}/${id}-${Date.now()}.jpg`;
    await getS3().send(new PutObjectCommand({ Bucket: requireAssetBucket(), Key: key, Body: jpg, ContentType: 'image/jpeg' }));
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  } catch (err) {
    console.error(`[YouTubeThumbnail] the picture of ${prefix}/${id} could not be drawn:`, err.message);
    return null;
  }
}

/** A small picture of a template (640×360 JPEG in S3), or null when it cannot be drawn. */
const drawTemplatePreview = (showId, templateId, spec) => drawLayersPreview(`shows/${showId}/thumbnail-templates`, templateId, spec);

async function setPreview(sequelize, templateId, url) {
  if (!url) return;
  await sequelize.query('UPDATE show_thumbnail_templates SET preview_url = :url WHERE id = :templateId',
    { replacements: { url, templateId } });
}

const uniqueViolation = (err) => err?.original?.code === '23505' || err?.parent?.code === '23505';
const violatedConstraint = (err) => String(err?.original?.constraint || err?.parent?.constraint || '');
// A name already in use (the name-per-show / name-per-episode indexes); any
// other unique index means two changes met at once (audit, 2026-10-22).
const nameTaken = (err) => uniqueViolation(err) && /_name_per_(show|episode)$/.test(violatedConstraint(err));
const BUSY = 'Something else changed this at the same moment; try again';

/**
 * The metadata template becomes a real row ("Default") the first time a
 * show's templates change, so it is kept. Returns its id, or null.
 */
async function adoptLegacy(sequelize, show, userId, transaction) {
  const [[{ n }]] = await sequelize.query(
    'SELECT COUNT(*)::int AS n FROM show_thumbnail_templates WHERE show_id = :showId AND deleted_at IS NULL',
    { replacements: { showId: show.id }, transaction });
  const legacy = n ? null : legacyTemplate(show);
  if (!legacy) return null;
  const [[row]] = await sequelize.query(
    `INSERT INTO show_thumbnail_templates (show_id, name, spec, is_default, created_by)
     VALUES (:showId, 'Default', CAST(:spec AS jsonb), true, :userId) RETURNING id`,
    { replacements: { showId: show.id, spec: JSON.stringify(legacy.spec), userId }, transaction });
  return row.id;
}

/** Saves a new named template. body: { name, spec, makeDefault? }. The show's first is its default. */
async function createTemplate(sequelize, showId, body = {}, userId = null) {
  await requireTemplates(sequelize);
  const name = templateName(body.name);
  const spec = layers.readLayers(body.spec, allowedImageUrl);
  let adopted = null;
  let created;
  try {
    created = await sequelize.transaction(async (transaction) => {
      const show = await findShow(sequelize, showId, transaction);
      adopted = await adoptLegacy(sequelize, show, userId, transaction);
      const [[{ n }]] = await sequelize.query(
        'SELECT COUNT(*)::int AS n FROM show_thumbnail_templates WHERE show_id = :showId AND deleted_at IS NULL',
        { replacements: { showId: show.id }, transaction });
      const isDefault = Boolean(body.makeDefault) || n === 0;
      if (isDefault) {
        await sequelize.query(
          'UPDATE show_thumbnail_templates SET is_default = false WHERE show_id = :showId AND is_default AND deleted_at IS NULL',
          { replacements: { showId: show.id }, transaction });
      }
      const [[row]] = await sequelize.query(
        `INSERT INTO show_thumbnail_templates (show_id, name, spec, is_default, created_by)
         VALUES (:showId, :name, CAST(:spec AS jsonb), :isDefault, :userId)
         RETURNING id, name, spec, preview_url, is_default, updated_at`,
        { replacements: { showId: show.id, name, spec: JSON.stringify(spec), isDefault, userId }, transaction });
      return row;
    });
  } catch (err) {
    if (nameTaken(err)) throw new ThumbnailError(409, 'That name is taken');
    if (uniqueViolation(err)) throw new ThumbnailError(409, BUSY);
    throw err;
  }
  if (adopted) {
    const [[old]] = await sequelize.query('SELECT spec FROM show_thumbnail_templates WHERE id = :id', { replacements: { id: adopted } });
    await setPreview(sequelize, adopted, await drawTemplatePreview(showId, adopted, layers.readLayers(old.spec, allowedImageUrl)));
  }
  created.preview_url = await drawTemplatePreview(showId, created.id, spec);
  await setPreview(sequelize, created.id, created.preview_url);
  return templateOut(created);
}

/**
 * Changes a template: body.name renames it (409 when the show has that name
 * already), body.spec replaces its layers (and its picture), body.isDefault
 * true makes it the one episodes start from. "legacy" is the metadata one,
 * which becomes a row first.
 */
async function updateTemplate(sequelize, showId, rawTemplateId, body = {}, userId = null) {
  await requireTemplates(sequelize);
  const templateId = templateIdOf(rawTemplateId);
  const name = body.name !== undefined ? templateName(body.name) : undefined;
  const spec = body.spec !== undefined ? layers.readLayers(body.spec, allowedImageUrl) : undefined;
  let row;
  try {
    row = await sequelize.transaction(async (transaction) => {
      const show = await findShow(sequelize, showId, transaction);
      const id = templateId === LEGACY_ID ? await adoptLegacy(sequelize, show, userId, transaction) : templateId;
      const [[found]] = id ? await sequelize.query(
        'SELECT id FROM show_thumbnail_templates WHERE id = :id AND show_id = :showId AND deleted_at IS NULL',
        { replacements: { id, showId: show.id }, transaction }) : [[null]];
      if (!found) throw new ThumbnailError(404, 'Template not found');
      if (body.isDefault === true) {
        await sequelize.query(
          'UPDATE show_thumbnail_templates SET is_default = false WHERE show_id = :showId AND is_default AND id <> :id AND deleted_at IS NULL',
          { replacements: { showId: show.id, id }, transaction });
      }
      const [[updated]] = await sequelize.query(
        `UPDATE show_thumbnail_templates
            SET name = COALESCE(:name, name),
                spec = COALESCE(CAST(:spec AS jsonb), spec),
                is_default = is_default OR :makeDefault,
                updated_at = NOW()
          WHERE id = :id
          RETURNING id, name, spec, preview_url, is_default, updated_at`,
        { replacements: { id, name: name ?? null, spec: spec ? JSON.stringify(spec) : null, makeDefault: body.isDefault === true }, transaction });
      return updated;
    });
  } catch (err) {
    if (nameTaken(err)) throw new ThumbnailError(409, 'That name is taken');
    if (uniqueViolation(err)) throw new ThumbnailError(409, BUSY);
    throw err;
  }
  if (spec || (templateId === LEGACY_ID && !row.preview_url)) {
    row.preview_url = await drawTemplatePreview(showId, row.id, layers.readLayers(row.spec, allowedImageUrl)) || row.preview_url;
    await setPreview(sequelize, row.id, row.preview_url);
  }
  return templateOut(row);
}

/** Deletes a template (kept with deleted_at). The default's place passes to the most recently changed one left. */
async function deleteTemplate(sequelize, showId, rawTemplateId) {
  await requireTemplates(sequelize);
  const templateId = templateIdOf(rawTemplateId);
  return sequelize.transaction(async (transaction) => {
    const show = await findShow(sequelize, showId, transaction);
    if (templateId === LEGACY_ID) {
      if (!legacyTemplate(show)) throw new ThumbnailError(404, 'Template not found');
      await sequelize.query(
        `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{youtube_thumbnail}',
            (COALESCE(metadata::jsonb -> 'youtube_thumbnail', '{}'::jsonb)) - 'template', true), updated_at = NOW()
          WHERE id = :showId`,
        { replacements: { showId: show.id }, transaction });
      return { id: LEGACY_ID };
    }
    const [[found]] = await sequelize.query(
      'SELECT id, is_default FROM show_thumbnail_templates WHERE id = :id AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { id: templateId, showId: show.id }, transaction });
    if (!found) throw new ThumbnailError(404, 'Template not found');
    await sequelize.query(
      'UPDATE show_thumbnail_templates SET deleted_at = NOW(), is_default = false WHERE id = :id',
      { replacements: { id: found.id }, transaction });
    if (found.is_default) {
      await sequelize.query(
        `UPDATE show_thumbnail_templates SET is_default = true
          WHERE id = (SELECT id FROM show_thumbnail_templates
                       WHERE show_id = :showId AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1)`,
        { replacements: { showId: show.id }, transaction });
    }
    return { id: found.id };
  });
}

// ── An episode's versions to compare (Evoni, 2026-10-21: "versions to
// compare"; episode_thumbnail_versions) ────────────────────────────────────

const VERSION_MAX = 12;

const versionsReady = async (sequelize) => {
  const [[reg]] = await sequelize.query("SELECT to_regclass('public.episode_thumbnail_versions') AS reg");
  return Boolean(reg && reg.reg);
};

const requireVersions = async (sequelize) => {
  if (!await versionsReady(sequelize)) {
    throw new ThumbnailError(503, 'Versions need the latest database update (episode_thumbnail_versions)');
  }
};

/** A version's name: trimmed, 1 to 80 characters. */
function versionName(raw) {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > TEMPLATE_NAME_MAX) throw new ThumbnailError(400, `A version needs a name of 1 to ${TEMPLATE_NAME_MAX} characters`);
  return name;
}

/** The first of "Version A", "Version B", ... the episode does not have yet. */
function nextVersionName(names) {
  const taken = new Set(names.map((n) => String(n).toLowerCase()));
  for (let i = 0; i < 26; i += 1) {
    const name = `Version ${String.fromCharCode(65 + i)}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `Version ${names.length + 1}`;
}

const versionOut = (r) => ({ id: r.id, name: r.name, previewUrl: r.preview_url || null, spec: readTemplate(r.spec), updatedAt: r.updated_at });

async function findEpisode(sequelize, episodeId, transaction, { lock = false } = {}) {
  if (!UUID.test(String(episodeId))) throw new ThumbnailError(404, 'Episode not found');
  // lock: the episode's row is held until the transaction ends, so two
  // changes to one episode's versions or thumbnails take turns.
  const [[episode]] = await sequelize.query(
    `SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1${lock && transaction ? ' FOR UPDATE' : ''}`,
    { replacements: { episodeId }, transaction });
  if (!episode) throw new ThumbnailError(404, 'Episode not found');
  return episode;
}

const versionIdOf = (id) => {
  if (UUID.test(String(id))) return id;
  throw new ThumbnailError(404, 'Version not found');
};

/** The episode's versions, oldest first ([] until their table exists). */
async function listVersions(sequelize, episodeId) {
  if (!UUID.test(String(episodeId)) || !await versionsReady(sequelize)) return [];
  const [rows] = await sequelize.query(
    `SELECT id, name, spec, preview_url, updated_at FROM episode_thumbnail_versions
      WHERE episode_id = :episodeId AND deleted_at IS NULL ORDER BY created_at, id`,
    { replacements: { episodeId } });
  return rows.map(versionOut);
}

const drawVersionPreview = (episodeId, versionId, spec) => drawLayersPreview(`episodes/${episodeId}/thumbnail-versions`, versionId, spec);

/** Keeps the arrangement as a version. body: { spec, name? } (the next "Version A, B, ..." when no name). At most 12. */
async function createVersion(sequelize, episodeId, body = {}, userId = null) {
  await requireVersions(sequelize);
  const spec = layers.readLayers(body.spec, allowedImageUrl);
  const given = body.name !== undefined && body.name !== null && String(body.name).trim() ? versionName(body.name) : null;
  let row;
  try {
    row = await sequelize.transaction(async (transaction) => {
      const episode = await findEpisode(sequelize, episodeId, transaction, { lock: true });
      const [names] = await sequelize.query(
        'SELECT name FROM episode_thumbnail_versions WHERE episode_id = :episodeId AND deleted_at IS NULL',
        { replacements: { episodeId: episode.id }, transaction });
      if (names.length >= VERSION_MAX) throw new ThumbnailError(409, `An episode keeps up to ${VERSION_MAX} versions; delete one first`);
      const name = given || nextVersionName(names.map((n) => n.name));
      const [[created]] = await sequelize.query(
        `INSERT INTO episode_thumbnail_versions (episode_id, name, spec, created_by)
         VALUES (:episodeId, :name, CAST(:spec AS jsonb), :userId)
         RETURNING id, name, spec, preview_url, updated_at`,
        { replacements: { episodeId: episode.id, name, spec: JSON.stringify(spec), userId }, transaction });
      return created;
    });
  } catch (err) {
    if (nameTaken(err)) throw new ThumbnailError(409, 'That name is taken');
    if (uniqueViolation(err)) throw new ThumbnailError(409, BUSY);
    throw err;
  }
  row.preview_url = await drawVersionPreview(episodeId, row.id, spec);
  if (row.preview_url) {
    await sequelize.query('UPDATE episode_thumbnail_versions SET preview_url = :url WHERE id = :id', { replacements: { url: row.preview_url, id: row.id } });
  }
  return versionOut(row);
}

/** Renames a version (body.name) and/or replaces its layers and picture (body.spec). */
async function updateVersion(sequelize, episodeId, rawVersionId, body = {}) {
  await requireVersions(sequelize);
  const versionId = versionIdOf(rawVersionId);
  const name = body.name !== undefined ? versionName(body.name) : undefined;
  const spec = body.spec !== undefined ? layers.readLayers(body.spec, allowedImageUrl) : undefined;
  let row;
  try {
    row = await sequelize.transaction(async (transaction) => {
      const episode = await findEpisode(sequelize, episodeId, transaction);
      const [[updated]] = await sequelize.query(
        `UPDATE episode_thumbnail_versions
            SET name = COALESCE(:name, name), spec = COALESCE(CAST(:spec AS jsonb), spec), updated_at = NOW()
          WHERE id = :versionId AND episode_id = :episodeId AND deleted_at IS NULL
          RETURNING id, name, spec, preview_url, updated_at`,
        { replacements: { versionId, episodeId: episode.id, name: name ?? null, spec: spec ? JSON.stringify(spec) : null }, transaction });
      if (!updated) throw new ThumbnailError(404, 'Version not found');
      return updated;
    });
  } catch (err) {
    if (nameTaken(err)) throw new ThumbnailError(409, 'That name is taken');
    if (uniqueViolation(err)) throw new ThumbnailError(409, BUSY);
    throw err;
  }
  if (spec) {
    row.preview_url = await drawVersionPreview(episodeId, row.id, spec) || row.preview_url;
    await sequelize.query('UPDATE episode_thumbnail_versions SET preview_url = :url WHERE id = :id', { replacements: { url: row.preview_url, id: row.id } });
  }
  return versionOut(row);
}

/** Deletes a version (kept with deleted_at). */
async function deleteVersion(sequelize, episodeId, rawVersionId) {
  await requireVersions(sequelize);
  const versionId = versionIdOf(rawVersionId);
  const episode = await findEpisode(sequelize, episodeId);
  const [rows] = await sequelize.query(
    `UPDATE episode_thumbnail_versions SET deleted_at = NOW()
      WHERE id = :versionId AND episode_id = :episodeId AND deleted_at IS NULL RETURNING id`,
    { replacements: { versionId, episodeId: episode.id } });
  if (!rows.length) throw new ThumbnailError(404, 'Version not found');
  return { id: versionId };
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

// YouTube refuses a custom thumbnail over 2 MB (Evoni, 2026-10-21: keep
// every saved one under it). A PNG that is too big is saved as a JPEG,
// at the best quality that fits.
const YOUTUBE_MAX_BYTES = 2 * 1024 * 1024;
const JPEG_QUALITIES = [92, 88, 84, 80, 75, 70, 64, 58, 50];

/**
 * The file a thumbnail is saved as: the PNG when it is within YouTube's
 * 2 MB, else the best-quality JPEG that is. { buffer, type: 'png' | 'jpeg',
 * mime, ext, bytes, pngBytes }.
 */
async function forYouTube(png) {
  if (png.length <= YOUTUBE_MAX_BYTES) {
    return { buffer: png, type: 'png', mime: 'image/png', ext: 'png', bytes: png.length, pngBytes: png.length };
  }
  let jpeg = null;
  for (const quality of JPEG_QUALITIES) {
    jpeg = await sharp(png).flatten({ background: '#000000' }).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= YOUTUBE_MAX_BYTES) break;
  }
  return { buffer: jpeg, type: 'jpeg', mime: 'image/jpeg', ext: 'jpg', bytes: jpeg.length, pngBytes: png.length };
}

// ── Saved thumbnails (episode_saved_thumbnails) ────────────────────────────
// Production's `thumbnails` table is an older one than its migration makes
// (snake_case columns, an integer episode_id that cannot hold an episode's
// UUID; Evoni, 2026-10-22: "column "s3Bucket" does not exist"), so the
// Studio keeps its saved thumbnails in a table of its own. Until that table
// exists, a save still sets episodes.thumbnail_url and the list is empty.

const savedReady = async (sequelize, transaction) => {
  const [[reg]] = await sequelize.query("SELECT to_regclass('public.episode_saved_thumbnails') AS reg", { transaction });
  return Boolean(reg && reg.reg);
};

// The layers a saved thumbnail was drawn from (20261022130000), so one can
// become the show's template (Evoni, 2026-10-22); until the column exists, none.
const savedSpecReady = async (sequelize, transaction) => {
  const [[col]] = await sequelize.query(
    `SELECT 1 AS present FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'episode_saved_thumbnails' AND column_name = 'spec'`,
    { transaction });
  return Boolean(col);
};

const requireSaved = async (sequelize) => {
  if (!await savedReady(sequelize)) {
    throw new ThumbnailError(503, 'Saved thumbnails need the latest database update (episode_saved_thumbnails)');
  }
};

/**
 * Uploads the thumbnail (as forYouTube gives it: under 2 MB) and makes it
 * the episode's current thumbnail; the one before it stays in the list.
 * Returns { id, url, key, type, bytes } (id null before the table exists).
 */
async function saveAsPrimary(sequelize, episodeId, png, spec = null) {
  const file = await forYouTube(png);
  const key = `episodes/${episodeId}/thumbnails/youtube-${Date.now()}.${file.ext}`;
  await getS3().send(new PutObjectCommand({ Bucket: requireAssetBucket(), Key: key, Body: file.buffer, ContentType: file.mime }));
  const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  const row = await sequelize.transaction(async (transaction) => {
    let created = null;
    // Two saves of one episode take turns, so the second sees the first's
    // current row and the one-current index is never hit (audit, 2026-10-22).
    await findEpisode(sequelize, episodeId, transaction, { lock: true });
    if (await savedReady(sequelize, transaction)) {
      await sequelize.query(
        `UPDATE episode_saved_thumbnails SET is_current = false, updated_at = NOW()
          WHERE episode_id = :episodeId AND is_current AND deleted_at IS NULL`,
        { replacements: { episodeId }, transaction });
      const withSpec = Boolean(spec) && await savedSpecReady(sequelize, transaction);
      [[created]] = await sequelize.query(
        `INSERT INTO episode_saved_thumbnails (episode_id, url, s3_bucket, s3_key, mime_type, file_size_bytes, width, height, is_current${withSpec ? ', spec' : ''})
         VALUES (:episodeId, :url, :bucket, :key, :mime, :size, ${WIDTH}, ${HEIGHT}, true${withSpec ? ', CAST(:spec AS jsonb)' : ''})
         RETURNING id`,
        { replacements: { episodeId, url, bucket: BUCKET, key, mime: file.mime, size: file.bytes, spec: withSpec ? JSON.stringify(spec) : null }, transaction });
    }
    await sequelize.query('UPDATE episodes SET thumbnail_url = :url WHERE id = :episodeId',
      { replacements: { episodeId, url }, transaction });
    return created;
  });
  return { id: row?.id || null, url, key, type: file.type, bytes: file.bytes };
}

// One thumbnail's pictures together stay under this (audit, 2026-10-22:
// 24 layers × 25 MB could hold 600 MB for one request).
const MAX_SPEC_PICTURE_BYTES = 120 * 1024 * 1024;

/** The pictures a thumbnail's visible image layers use, fetched: { [layerId]: Buffer }. */
async function layerPictures(spec) {
  const out = {};
  let total = 0;
  const wanted = spec.layers.filter((l) => l.kind === 'image' && l.visible && l.src);
  // A few at a time, so the running total is checked as they come.
  for (let i = 0; i < wanted.length; i += 4) {
    const got = await Promise.all(wanted.slice(i, i + 4).map(async (l) => [l.id, await fetchImage(l.src)]));
    for (const [id, buf] of got) {
      total += buf.length;
      if (total > MAX_SPEC_PICTURE_BYTES) throw new ThumbnailError(400, 'The pictures in this thumbnail are too big together (120 MB at most)');
      out[id] = buf;
    }
  }
  return out;
}

/**
 * At most RENDER_SLOTS thumbnails are drawn at once on this server; the rest
 * wait their turn, and past RENDER_QUEUE_MAX waiting the answer is "busy"
 * (audit, 2026-10-22: drawing is heavy and holds the server while it runs).
 */
const RENDER_SLOTS = 3;
const RENDER_QUEUE_MAX = 60;
let rendering = 0;
const waiting = [];
async function withRenderSlot(fn) {
  if (rendering < RENDER_SLOTS) {
    rendering += 1;
  } else {
    if (waiting.length >= RENDER_QUEUE_MAX) throw new ThumbnailError(503, 'The thumbnail drawer is busy; try again in a moment');
    await new Promise((resolve) => waiting.push(resolve)); // the slot is handed over, already counted
  }
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else rendering -= 1;
  }
}

/** Renders a layered thumbnail ({ version: 2, layers }, already read): PNG, 1280×720. */
async function renderSpec(spec) {
  return withRenderSlot(async () => layers.renderLayers(spec, await layerPictures(spec)));
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
  // The name rides in the key, so the episode's uploads can be listed with their names.
  const named = uploadName(name);
  const key = `${uploadsPrefix(episodeId)}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${named ? `--${named}` : ''}.${ext}`;
  await getS3().send(new PutObjectCommand({ Bucket: requireAssetBucket(), Key: key, Body: buffer, ContentType: contentType }));
  return { url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`, label: labelOfUpload(key) };
}

const uploadsPrefix = (episodeId) => `episodes/${episodeId}/thumbnail-pictures/`;

/** A file's name as it can sit in a key: its stem, letters, digits and dashes, 60 at most. */
const uploadName = (name) => String(name || '').replace(/\.[a-z0-9]+$/i, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** An upload's label from its key: the name it was uploaded with, else "Upload". */
function labelOfUpload(key) {
  const m = /--([a-z0-9-]+)\.[a-z0-9]+$/.exec(key);
  if (!m) return 'Upload';
  const words = m[1].replace(/-/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Upload';
}

/**
 * The pictures uploaded in the Studio for this episode, newest first (at
 * most 60), as { url, label }; kept in S3, so they are listed on every
 * visit (Evoni, 2026-10-21). Empty when the bucket cannot be listed.
 */
async function listUploads(episodeId) {
  try {
    const out = await getS3().send(new ListObjectsV2Command({ Bucket: requireAssetBucket(), Prefix: uploadsPrefix(episodeId), MaxKeys: 200 }));
    return (out.Contents || [])
      .filter((o) => /\.(png|jpe?g|webp|avif)$/i.test(o.Key || ''))
      .sort((a, b) => new Date(b.LastModified || 0) - new Date(a.LastModified || 0))
      .slice(0, 60)
      .map((o) => ({ url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${o.Key}`, label: labelOfUpload(o.Key) }));
  } catch (err) {
    console.error(`[YouTubeThumbnail] the uploads of episode ${episodeId} could not be listed:`, err.message);
    return [];
  }
}

/** The episode's saved thumbnails, its current one first, then newest first ([] before the table exists). */
async function listSaved(sequelize, episodeId) {
  if (!UUID.test(String(episodeId)) || !await savedReady(sequelize)) return [];
  const withSpec = await savedSpecReady(sequelize);
  const [rows] = await sequelize.query(
    `SELECT id, url, is_current, width, height, created_at${withSpec ? ', spec' : ''}
       FROM episode_saved_thumbnails
      WHERE episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY is_current DESC, created_at DESC, id
      LIMIT 100`,
    { replacements: { episodeId } });
  return (rows || []).map((r) => ({
    id: r.id,
    url: r.url,
    isPrimary: Boolean(r.is_current),
    width: r.width,
    height: r.height,
    savedAt: r.created_at,
    spec: r.spec || null,
  }));
}

async function findSaved(sequelize, episodeId, thumbnailId, transaction) {
  const [[row]] = UUID.test(String(episodeId)) && UUID.test(String(thumbnailId))
    ? await sequelize.query(
      `SELECT id, url, is_current FROM episode_saved_thumbnails
        WHERE id = :thumbnailId AND episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId, thumbnailId }, transaction })
    : [[]];
  if (!row) throw new ThumbnailError(404, 'That thumbnail is not one of this episode\'s');
  return row;
}

/** Makes a saved thumbnail the episode's thumbnail again; the current one stays in the list. */
async function makePrimary(sequelize, episodeId, thumbnailId) {
  await requireSaved(sequelize);
  return sequelize.transaction(async (transaction) => {
    await findEpisode(sequelize, episodeId, transaction, { lock: true });
    const row = await findSaved(sequelize, episodeId, thumbnailId, transaction);
    await sequelize.query(
      `UPDATE episode_saved_thumbnails SET is_current = false, updated_at = NOW()
        WHERE episode_id = :episodeId AND is_current AND deleted_at IS NULL AND id <> :thumbnailId`,
      { replacements: { episodeId, thumbnailId }, transaction });
    await sequelize.query(
      'UPDATE episode_saved_thumbnails SET is_current = true, updated_at = NOW() WHERE id = :thumbnailId',
      { replacements: { thumbnailId }, transaction });
    await sequelize.query('UPDATE episodes SET thumbnail_url = :url WHERE id = :episodeId',
      { replacements: { episodeId, url: row.url }, transaction });
    return { id: row.id, url: row.url };
  });
}

/**
 * Deletes a saved thumbnail that is not the episode's current one (marked
 * deleted; the S3 file stays). The current one is refused: make another
 * current first.
 */
async function removeSaved(sequelize, episodeId, thumbnailId) {
  await requireSaved(sequelize);
  const row = await findSaved(sequelize, episodeId, thumbnailId);
  if (row.is_current) {
    throw new ThumbnailError(409, 'This is the episode\'s thumbnail. Make another one the thumbnail first.');
  }
  // NOT is_current: if it was made the thumbnail meanwhile (another tab),
  // nothing is deleted and the same answer comes back (audit, 2026-10-22).
  const [gone] = await sequelize.query(
    `UPDATE episode_saved_thumbnails SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = :thumbnailId AND episode_id = :episodeId AND deleted_at IS NULL AND NOT is_current
      RETURNING id`,
    { replacements: { episodeId, thumbnailId } });
  if (!gone || !gone.length) {
    throw new ThumbnailError(409, 'This is the episode\'s thumbnail. Make another one the thumbnail first.');
  }
  return { id: row.id };
}

// ── A whole season at once (Evoni, 2026-10-21) ──────────────────────────────

const SEASON_MAX = 200;
const SMALL_WIDTH = 640;

/**
 * The show's episodes in order, each with its current thumbnail (the
 * primary one, else episodes.thumbnail_url; null when it has none) and
 * whether it has its own arrangement (a draft).
 */
async function seasonEpisodes(sequelize, showId) {
  const show = await findShow(sequelize, showId);
  const drafts = await draftsReady(sequelize);
  const saved = await savedReady(sequelize);
  const [rows] = await sequelize.query(
    `SELECT e.id, e.title, e.episode_number, e.thumbnail_url,
            ${saved ? '(SELECT s.url FROM episode_saved_thumbnails s WHERE s.episode_id = e.id AND s.is_current AND s.deleted_at IS NULL LIMIT 1)' : 'NULL'} AS current_url,
            ${drafts ? 'EXISTS (SELECT 1 FROM episode_thumbnail_drafts d WHERE d.episode_id = e.id AND d.deleted_at IS NULL)' : 'false'} AS has_draft
       FROM episodes e
      WHERE e.show_id = :showId AND e.deleted_at IS NULL
      ORDER BY e.episode_number ASC NULLS LAST, e.created_at ASC
      LIMIT ${SEASON_MAX}`,
    { replacements: { showId: show.id } });
  return (rows || []).map((r) => ({
    id: r.id,
    title: r.title,
    episode_number: r.episode_number,
    thumbnailUrl: r.current_url || r.thumbnail_url || null,
    hasDraft: Boolean(r.has_draft),
  }));
}

/** A small JPEG of a drawn thumbnail (640 × 360), for a grid of them. */
async function smallPreview(png) {
  return sharp(png).resize(SMALL_WIDTH).flatten({ background: '#000000' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

// ── Several thumbnails in one zip (Evoni, 2026-10-22) ───────────────────────
// The season's ticked ones, or 2–3 versions for YouTube's Test & Compare; each
// as it would be saved (under YouTube's 2 MB, forYouTube).

const ZIP_MAX = 60;

const fileSlug = (name) => String(name || 'thumbnail').normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
  .replace(/\s+/g, '-').slice(0, 60) || 'thumbnail';

/** The items asked for, read and checked before anything is sent: [{ name, spec }]. */
function zipItems(body, allowedUrl = allowedImageUrl) {
  const items = body && Array.isArray(body.items) ? body.items : null;
  if (!items || !items.length) throw new ThumbnailError(400, 'items must be a list of { name, spec }');
  if (items.length > ZIP_MAX) throw new ThumbnailError(400, `At most ${ZIP_MAX} thumbnails in one zip`);
  return items.map((it, i) => ({
    name: `${String(i + 1).padStart(2, '0')}-${fileSlug(it && it.name)}`,
    spec: layers.readLayers(it && it.spec, allowedUrl),
  }));
}

/** Draws each and streams them into a zip on out (a response), one after another. */
async function zipThumbnails(items, out) {
  // Pictures are compressed already: stored, not squeezed again.
  const archive = archiver('zip', { store: true });
  const done = new Promise((resolve, reject) => {
    archive.on('error', reject);
    out.on('close', resolve);
    out.on('finish', resolve);
  });
  archive.pipe(out);
  for (const it of items) {
    const file = await forYouTube(await renderSpec(it.spec));
    archive.append(file.buffer, { name: `${it.name}.${file.ext}` });
  }
  await archive.finalize();
  await done;
}

module.exports = {
  withRenderSlot, RENDER_SLOTS, RENDER_QUEUE_MAX, MAX_SPEC_PICTURE_BYTES,
  readBrand,
  saveBrand,
  BRAND_COLOURS_MAX,
  zipItems,
  zipThumbnails,
  ZIP_MAX,
  WIDTH, HEIGHT, LAYOUTS, DEFAULT_STYLE, ThumbnailError, YOUTUBE_MAX_BYTES, forYouTube,
  readStyle, allowedImageUrl, fetchImage, previewImage, PREVIEW_WIDTHS, readyPoses, pictureFolders, libraryImages, outfitImages, layoutSuggestions,
  sources, saveStyle, saveAsPrimary, listSaved, makePrimary, removeSaved, seasonEpisodes, smallPreview, SMALL_WIDTH,
  readTemplate, renderSpec, getDraft, saveDraft, uploadPicture, listUploads, labelOfUpload,
  LEGACY_ID, templateName, listTemplates, listAllTemplates, createTemplate, updateTemplate, deleteTemplate,
  VERSION_MAX, nextVersionName, listVersions, createVersion, updateVersion, deleteVersion,
};
