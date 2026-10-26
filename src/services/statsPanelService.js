'use strict';

/**
 * The stats panel: an overlay the audience sees on the episode video, not
 * part of Lala's Phone (Task #3164; Evoni, 2026-10-14: "keep the stats panel
 * separate from Lala's Phone UI. The stats overlay is something the audience
 * sees, not something Lala necessarily sees in her world").
 *
 * The master art is one of the show's overlays (Assets → Overlays), a PNG
 * of 1920 × 220 with a transparent background and the 1600 × 180 design
 * centred inside it. Its image's metadata holds the panel:
 *
 *   metadata.stats_panel = { spots: [{ id, stat, x, y, w, h, icon, color }] }
 *     stat        'coins' | 'reputation' | 'influence' | 'followers' | 'stress'
 *     x, y, w, h  the number's box, in percent of the master
 *     icon        an overlay's key (an icon she uploaded to Overlays), drawn
 *                 beside the number; null draws none
 *     color       '#rrggbb' for the number; null is white
 *
 * Each number is "before → after" for the episode (Evoni, 2026-10-14):
 * before is Lala's stats going in (during the episode, beatOrder), after is
 * with the episode's own changes (its "after" moment, n × 10 + 7), both from
 * lalaStats.statsAt. Followers are left out until The Pulse has her numbers.
 *
 * The PNG is drawn with node-canvas: 1920 × 220 for YouTube 1080p, 3840 ×
 * 440 for 4K (the design at 3200 × 360). A downloadable PNG per episode
 * for now; editing inside the app's video comes later. Vertical Shorts and
 * Reels get a second master later.
 */

const STATS = ['coins', 'reputation', 'influence', 'followers', 'stress'];
// Stats where lower is better (Evoni, 2026-10-25: stress on the stats card).
const LOWER_IS_BETTER = new Set(['stress']);
// A stress number with no colour of its own shows which way it went:
// green when it fell, rose when it rose; white when it held.
const TREND_COLORS = { better: '#7BD389', worse: '#F28B82' };
const SPOTS_MAX = 8;
const SIZES = { '1080p': { width: 1920, height: 220 }, '4k': { width: 3840, height: 440 } };
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ICON_KEY_RE = /^[a-z0-9_-]{1,80}$/i;

class StatsPanelError extends Error {
  constructor(message, status = 400, code = 'STATS_PANEL') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The first problem with the spots, in plain words; null when they are fine. */
function spotsProblem(spots) {
  if (!Array.isArray(spots)) return 'spots must be a list.';
  if (spots.length > SPOTS_MAX) return `A stats panel holds at most ${SPOTS_MAX} numbers.`;
  for (let i = 0; i < spots.length; i += 1) {
    const s = spots[i];
    const n = i + 1;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return `Number ${n} is not a box.`;
    if (typeof s.id !== 'string' || !s.id || s.id.length > 80) return `Number ${n} has no id.`;
    if (!STATS.includes(s.stat)) return `Number ${n}: the stat must be one of ${STATS.join(', ')}.`;
    for (const k of ['x', 'y', 'w', 'h']) {
      if (typeof s[k] !== 'number' || !Number.isFinite(s[k]) || s[k] < 0 || s[k] > 100) return `Number ${n}: ${k} must be a number from 0 to 100.`;
    }
    if (s.w < 1 || s.h < 1) return `Number ${n} is too small.`;
    if (s.icon != null && (typeof s.icon !== 'string' || !ICON_KEY_RE.test(s.icon))) return `Number ${n}: the icon is not one of the show's overlays.`;
    if (s.color != null && (typeof s.color !== 'string' || !COLOR_RE.test(s.color))) return `Number ${n}: the colour must be like #FFFFFF.`;
  }
  return null;
}

const fmt = (v) => Number(v).toLocaleString('en-US');

/** One stat's value as text: coins as a count, reputation, influence and stress out of the scale. */
function valueText(stats, stat) {
  if (!stats) return '—';
  if (stat === 'followers') return stats.followers ? fmt(stats.followers.count) : '—';
  const v = stats[stat];
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
  return stat === 'coins' ? fmt(v) : `${fmt(v)}/${stats.scale || 10}`;
}

/** 'better' | 'worse' | 'same' | null: which way the stat went, lower being better for stress. */
function trendOf(stat, before, after) {
  const value = (stats) => (stat === 'followers' ? stats?.followers?.count : stats?.[stat]);
  const a = Number(value(before));
  const b = Number(value(after));
  if (value(before) == null || value(after) == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return 'same';
  const up = b > a;
  return (LOWER_IS_BETTER.has(stat) ? !up : up) ? 'better' : 'worse';
}

/**
 * Each spot's text, "before → after", and its trend; a followers spot is
 * left out while neither side has her numbers. A stress spot with no colour
 * of its own is drawn in its trend's colour (lower is better). Pure, so the
 * preview and the PNG agree.
 */
function spotTexts(spots, before, after) {
  return (spots || [])
    .filter((s) => s.stat !== 'followers' || before?.followers || after?.followers)
    .map((s) => {
      const trend = trendOf(s.stat, before, after);
      const color = !s.color && LOWER_IS_BETTER.has(s.stat) && TREND_COLORS[trend] ? TREND_COLORS[trend] : s.color;
      return { ...s, color: color ?? null, trend, text: `${valueText(before, s.stat)} → ${valueText(after, s.stat)}` };
    });
}

/** Lala's stats going into episode n and with its changes (storyClock orders). */
async function episodeStats(models, showId, episodeNumber) {
  const { statsAt } = require('./lalaStats');
  const { orderOf } = require('./storyClock');
  const n = Number.isInteger(Number(episodeNumber)) ? Number(episodeNumber) : 0;
  const [before, after] = await Promise.all([
    statsAt(models, showId, orderOf(n, 'during_episode')),
    statsAt(models, showId, orderOf(n, 'after_episode')),
  ]);
  return { before, after };
}

const parse = (text) => {
  try { return text ? JSON.parse(text) : {}; } catch (err) {
    console.error('[StatsPanel] unreadable overlay metadata:', err.message);
    return {};
  }
};

/** The show's stats panel: its master image and spots, or null when none is set up. */
async function findPanel(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT id, metadata::text AS metadata_text, COALESCE(s3_url_processed, s3_url_raw) AS url
       FROM assets
      WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND episode_id IS NULL AND deleted_at IS NULL
        AND jsonb_exists(metadata, 'stats_panel')
      ORDER BY updated_at DESC
      LIMIT 1`,
    { replacements: { showId } });
  const row = rows?.[0];
  if (!row) return null;
  const meta = parse(row.metadata_text);
  return { asset_id: row.id, overlay_type: meta.overlay_type || null, url: row.url, spots: Array.isArray(meta.stats_panel?.spots) ? meta.stats_panel.spots : [] };
}

/** Each icon key's current image (the show's overlay of that key), so a new picture shows at once. */
async function iconUrls(sequelize, showId, keys) {
  const wanted = [...new Set((keys || []).filter(Boolean))];
  if (!wanted.length) return {};
  const [rows] = await sequelize.query(
    `SELECT metadata->>'overlay_type' AS key, COALESCE(s3_url_processed, s3_url_raw) AS url
       FROM assets
      WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND episode_id IS NULL AND deleted_at IS NULL
        AND metadata->>'overlay_type' IN (:keys) AND NOT jsonb_exists(metadata, 'variant_label')
      ORDER BY created_at DESC`,
    { replacements: { showId, keys: wanted } });
  const out = {};
  for (const r of rows || []) if (r.url && !out[r.key]) out[r.key] = r.url;
  return out;
}

/**
 * Save the panel's spots on its master image (a show overlay's image).
 * `spots: null` makes the image an ordinary overlay again.
 */
async function saveSpots(models, showId, assetId, spots) {
  const clear = spots === null;
  const problem = clear ? null : spotsProblem(spots);
  if (problem) throw new StatsPanelError(problem, 400, 'INVALID_SPOTS');
  const [, meta] = await models.sequelize.query(
    `UPDATE assets
        SET metadata = ${clear ? `COALESCE(metadata, '{}'::jsonb) - 'stats_panel'` : `COALESCE(metadata, '{}'::jsonb) || CAST(:patch AS jsonb)`}, updated_at = NOW()
      WHERE id = :assetId AND show_id = :showId AND asset_type = 'UI_OVERLAY' AND episode_id IS NULL AND deleted_at IS NULL`,
    { replacements: { assetId, showId, patch: JSON.stringify({ stats_panel: { spots } }) } });
  if (meta && typeof meta.rowCount === 'number' && meta.rowCount === 0) {
    throw new StatsPanelError('That overlay image was replaced or removed. Reload and try again.', 404, 'NO_IMAGE');
  }
  return { asset_id: assetId, spots: clear ? null : spots };
}

/** The episode's panel: { panel, episode, before, after, spots (with text) }. */
async function episodePanel(models, showId, episodeId) {
  const { sequelize } = models;
  const [[ep]] = await sequelize.query(
    'SELECT id, episode_number FROM episodes WHERE id = :episodeId AND show_id = :showId AND deleted_at IS NULL',
    { replacements: { episodeId, showId } });
  if (!ep) throw new StatsPanelError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  const panel = await findPanel(sequelize, showId);
  if (!panel) throw new StatsPanelError('Set up the stats panel first: in Assets → Overlays, open your panel art and add its numbers.', 404, 'NO_PANEL');
  const { before, after } = await episodeStats(models, showId, ep.episode_number);
  return { panel, episode: { id: ep.id, episode_number: ep.episode_number }, before, after, spots: spotTexts(panel.spots, before, after) };
}

async function loadImage(url) {
  const { loadImage: load } = require('canvas');
  if (String(url).startsWith('data:')) return load(Buffer.from(String(url).split(',')[1], 'base64'));
  const axios = require('axios');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return load(Buffer.from(res.data));
}

/** The text's font size: most of the box's height, shrunk until it fits its width. */
function fitFont(ctx, text, maxWidth, maxHeight) {
  let size = Math.max(6, Math.floor(maxHeight * 0.62));
  const font = (px) => `bold ${px}px sans-serif`;
  ctx.font = font(size);
  while (size > 6 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = font(size);
  }
  return size;
}

/** The PNG: the master with each icon and "before → after" drawn in its box. */
async function renderPng(models, showId, episodeId, size = '1080p') {
  const dims = SIZES[size];
  if (!dims) throw new StatsPanelError(`size must be one of ${Object.keys(SIZES).join(', ')}`, 400, 'INVALID_SIZE');
  const data = await episodePanel(models, showId, episodeId);
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(dims.width, dims.height);
  const ctx = canvas.getContext('2d');
  if (data.panel.url) ctx.drawImage(await loadImage(data.panel.url), 0, 0, dims.width, dims.height);
  const icons = await iconUrls(models.sequelize, showId, data.spots.map((s) => s.icon));
  for (const spot of data.spots) {
    const box = { x: (spot.x / 100) * dims.width, y: (spot.y / 100) * dims.height, w: (spot.w / 100) * dims.width, h: (spot.h / 100) * dims.height };
    let textX = box.x;
    if (spot.icon && icons[spot.icon]) {
      try {
        const img = await loadImage(icons[spot.icon]);
        const side = Math.min(box.h, box.w / 3);
        ctx.drawImage(img, box.x, box.y + (box.h - side) / 2, side, side);
        textX = box.x + side + side * 0.2;
      } catch (err) {
        // The number is still drawn without its icon.
        console.error('[StatsPanel] icon could not be drawn:', spot.icon, err.message);
      }
    }
    const room = box.x + box.w - textX;
    fitFont(ctx, spot.text, room, box.h);
    ctx.fillStyle = spot.color || '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(spot.text, textX, box.y + box.h / 2);
  }
  const n = data.episode.episode_number != null ? String(data.episode.episode_number).padStart(2, '0') : 'episode';
  return { buffer: canvas.toBuffer('image/png'), filename: `stats-panel-episode-${n}-${size}.png` };
}

module.exports = {
  STATS, SIZES, SPOTS_MAX, StatsPanelError, LOWER_IS_BETTER, TREND_COLORS,
  spotsProblem, valueText, trendOf, spotTexts, episodeStats, findPanel, iconUrls, saveSpots, episodePanel, renderPng,
};
