'use strict';

/**
 * The approved style sheet in the episode's Distribution (Task #2878).
 *
 * Distribution is one record per episode (episodes.distribution_metadata,
 * keyed by platform). "Send to Distribution" adds a `style_sheet` entry to
 * it, with no new table (Evoni, 2026-10-10):
 *
 *   { sent_at, sent_by, sheet_hash, items: [{ size, label, ... }],
 *     caption, caption_edited, include_shop_links }
 *
 * The items are the export sizes of the sheet that was approved; each is
 * drawn on request by GET /episodes/:id/style-sheet/export/:size, so no
 * image is stored. Shop the Look links and the affiliate disclosure are
 * read from the look's wardrobe pieces every time, so the disclosure is
 * there whenever an included link is an affiliate link and cannot be
 * edited away. Nothing is posted anywhere and no external service is called.
 */

const { LookbookError } = require('./episodeLookbookService');

const DISCLOSURE = 'Some links are affiliate links; I may earn a commission.';
const CAPTION_MAX = 2200;
const KEY = 'style_sheet';

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

function parseMetadata(v) {
  let out = v;
  // The episode update route has stored it as a JSON string inside the column.
  for (let i = 0; i < 2 && typeof out === 'string'; i += 1) {
    try { out = JSON.parse(out); } catch (err) {
      console.error('[StyleSheetDistribution] unreadable distribution_metadata:', err.message);
      return {};
    }
  }
  return isObject(out) ? out : {};
}

async function readMetadata(sequelize, episodeId) {
  const [[row]] = await sequelize.query(
    'SELECT distribution_metadata FROM episodes WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id: episodeId } });
  if (!row) throw new LookbookError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  return parseMetadata(row.distribution_metadata);
}

async function writeMetadata(models, episodeId, metadata) {
  await models.Episode.update({ distribution_metadata: metadata }, { where: { id: episodeId, deleted_at: null } });
}

/**
 * For the other Distribution writers (the tab's Save, Generate, the episode
 * update): what they save, with the style sheet entry carried over from the
 * stored record. The entry is only ever written by this service.
 */
async function keepStyleSheet(sequelize, episodeId, incoming) {
  const next = { ...parseMetadata(incoming) };
  delete next[KEY];
  const [[row]] = await sequelize.query(
    'SELECT distribution_metadata FROM episodes WHERE id = :id', { replacements: { id: episodeId } });
  const stored = row ? parseMetadata(row.distribution_metadata)[KEY] : null;
  if (stored) next[KEY] = stored;
  return next;
}

/** "Episode 01: Title", the event and its host, the tagline; only what canon holds. */
function captionDraft(sheet) {
  const ep = sheet.episode || {};
  const episodeLine = [ep.number != null ? `Episode ${String(ep.number).padStart(2, '0')}` : null, text(ep.title)].filter(Boolean).join(': ');
  const ev = sheet.event || {};
  const eventLine = [text(ev.name), text(ev.host)].filter(Boolean).join(' · ');
  return [episodeLine, eventLine, text(sheet.tagline)].filter(Boolean).join('\n\n');
}

/**
 * The saved look's pieces that have a real-world link: the affiliate link
 * when there is one, else the product page.
 */
async function shopLinks(models, sheet) {
  const ids = (sheet.wardrobe_piece_ids || []).filter(Boolean);
  if (!ids.length) return [];
  const rows = await models.sequelize.query(
    `SELECT id, name, real_brand, real_product_name, real_retailer, real_product_url, affiliate_url
       FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids }, type: models.sequelize.QueryTypes.SELECT });
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const links = [];
  for (const id of ids) {
    const r = byId.get(String(id));
    if (!r) continue;
    const affiliate = text(r.affiliate_url);
    const url = affiliate || text(r.real_product_url);
    if (!url) continue;
    const label = [text(r.real_brand), text(r.real_product_name)].filter(Boolean).join(' ') || text(r.name) || 'Piece';
    links.push({ piece_id: r.id, label, retailer: text(r.real_retailer), url, affiliate: Boolean(affiliate) });
  }
  return links;
}

/** The text she copies: the locked disclosure, her caption, then the links. */
function postText(caption, links, disclosure) {
  const parts = [];
  if (disclosure) parts.push(disclosure);
  if (text(caption)) parts.push(caption.trim());
  if (links.length) parts.push(['Shop the Look', ...links.map((l) => `${l.label}: ${l.url}`)].join('\n'));
  return parts.join('\n\n');
}

async function sheetFor(models, episodeId) {
  const { buildStyleSheet } = require('./styleSheetService');
  return buildStyleSheet(models, episodeId);
}

/** The stored entry as the Distribution tab shows it, or { sent: false }. */
async function view(models, episodeId, entry, sheet) {
  if (!entry) return { sent: false };
  const { EXPORTS } = require('./styleSheetRenderService');
  const links = await shopLinks(models, sheet);
  const included = entry.include_shop_links ? links : [];
  const disclosure = included.some((l) => l.affiliate) ? DISCLOSURE : null;
  const outOfDate = sheet.status !== 'approved' || sheet.stale || sheet.inputs_hash !== entry.sheet_hash;
  return {
    sent: true,
    sent_at: entry.sent_at,
    sent_by: entry.sent_by || null,
    out_of_date: outOfDate,
    items: (entry.items || []).filter((i) => EXPORTS[i.size]).map((i) => ({
      ...i, path: `/api/v1/episodes/${episodeId}/style-sheet/export/${i.size}`,
    })),
    caption: entry.caption || '',
    caption_max: CAPTION_MAX,
    include_shop_links: Boolean(entry.include_shop_links),
    shop_links: links,
    disclosure,
    disclosure_locked: Boolean(disclosure),
    post_text: postText(entry.caption || '', included, disclosure),
  };
}

async function getStyleSheetDistribution(models, episodeId) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? metadata[KEY] : null;
  if (!entry) return { sent: false };
  return view(models, episodeId, entry, await sheetFor(models, episodeId));
}

/**
 * Send to Distribution: one item per export size of the approved sheet,
 * with a caption draft. Sending again (after a re-approval) replaces the
 * items and keeps a caption she has edited.
 */
async function sendStyleSheetToDistribution(models, episodeId, { includeShopLinks = false } = {}, user = null) {
  const { EXPORTS } = require('./styleSheetRenderService');
  const sheet = await sheetFor(models, episodeId);
  if (sheet.status !== 'approved') throw new LookbookError('Approve the style sheet before sending it to Distribution.', 409, 'SHEET_NOT_APPROVED');
  if (sheet.stale) throw new LookbookError('The event or the look changed since approval; approve the style sheet again before sending it.', 409, 'SHEET_OUT_OF_DATE');
  const metadata = await readMetadata(models.sequelize, episodeId);
  const previous = isObject(metadata[KEY]) ? metadata[KEY] : null;
  const n = sheet.episode?.number != null ? String(sheet.episode.number).padStart(2, '0') : 'episode';
  const keepCaption = previous && previous.caption_edited;
  const entry = {
    sent_at: new Date().toISOString(),
    sent_by: user ? String(user.email || user.id || user.sub || '').slice(0, 255) || null : null,
    sheet_hash: sheet.inputs_hash,
    items: Object.entries(EXPORTS).map(([size, e]) => ({
      size, label: e.label, width: e.width, height: e.height, type: e.type, filename: `style-sheet-episode-${n}-${size}.${e.ext}`,
    })),
    caption: keepCaption ? previous.caption : captionDraft(sheet),
    caption_edited: Boolean(keepCaption),
    include_shop_links: Boolean(includeShopLinks),
  };
  await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  return view(models, episodeId, entry, sheet);
}

/** Edit the caption or the Shop the Look toggle of the sent sheet. */
async function updateStyleSheetDistribution(models, episodeId, body = {}) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? { ...metadata[KEY] } : null;
  if (!entry) throw new LookbookError('The style sheet has not been sent to Distribution.', 404, 'NOT_SENT');
  if (body.caption !== undefined) {
    if (typeof body.caption !== 'string') throw new LookbookError('caption is text.', 400, 'BAD_CAPTION');
    if (body.caption.length > CAPTION_MAX) throw new LookbookError(`The caption is at most ${CAPTION_MAX} characters.`, 400, 'CAPTION_TOO_LONG');
    entry.caption = body.caption;
    entry.caption_edited = true;
  }
  if (body.include_shop_links !== undefined) entry.include_shop_links = Boolean(body.include_shop_links);
  await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  return view(models, episodeId, entry, await sheetFor(models, episodeId));
}

/** Take the style sheet out of Distribution; the platform entries stay. */
async function removeStyleSheetFromDistribution(models, episodeId) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  if (metadata[KEY] !== undefined) {
    const next = { ...metadata };
    delete next[KEY];
    await writeMetadata(models, episodeId, next);
  }
  return { sent: false };
}

module.exports = {
  DISCLOSURE, CAPTION_MAX, captionDraft, postText, keepStyleSheet, parseMetadata,
  getStyleSheetDistribution, sendStyleSheetToDistribution, updateStyleSheetDistribution, removeStyleSheetFromDistribution,
};
