'use strict';

/**
 * The approved style sheet in the episode's Distribution (Task #2878).
 *
 * Distribution is one record per episode (episodes.distribution_metadata,
 * keyed by platform). "Send to Distribution" adds a `style_sheet` entry to
 * it, with no new table (Evoni, 2026-10-10):
 *
 *   { sent_at, sent_by, sheet_hash, items: [{ size, label, ... }],
 *     designs: [{ design, name, sizes: [{ size, label, ... }] }],
 *     caption, caption_edited, include_shop_links }
 *
 * `designs` (Evoni, 2026-10-22) are her five Canva designs in the six
 * platform sizes, drawn by GET /episodes/:id/style-sheet/design/:design/:size.
 *
 * The items are the export sizes of the sheet that was approved; each is
 * drawn on request by GET /episodes/:id/style-sheet/export/:size, so no
 * image is stored. Shop the Look links and the disclosure are read from the
 * look's wardrobe pieces every time (Evoni, 2026-10-14; Task #3170): the
 * affiliate sentence leads whenever links are included, the Amazon
 * Associates sentence follows whenever an included link is an Amazon link,
 * and neither can be edited away. Nothing is posted anywhere and no external
 * service is called.
 *
 * On the website (Task #3021; The Pulse spec §10): Evoni publishes a sent
 * sheet's Shop the Look with { site: { published_at, published_by, key,
 * piece_ids } } on the same entry. key is random and is the look's only
 * public id; piece_ids are the look's wardrobe ids at publishing (ids, never
 * copies), so the public read takes each piece's links live without
 * rebuilding the sheet. Sending again keeps the record (with the new look's
 * pieces); removing the sheet from Distribution takes it down. A published
 * look shows only while its Shop the Look links are included and there is
 * at least one.
 *
 * Its image (Task #3120; Evoni, 2026-10-13: the look strip): publishing
 * draws the approved sheet's "The look only" export and copies it to the
 * public site bucket, recording site.image = { key, sheet_hash }; publishing
 * again draws it again. Without SITE_PUBLIC_BUCKET nothing is copied and the
 * page is text only; a draw or upload that fails is logged, marked
 * { failed: true }, and the look still publishes. Sending a re-approved
 * sheet drops an image of the old look until she publishes again.
 */

const crypto = require('crypto');
const { LookbookError } = require('./episodeLookbookService');

const DISCLOSURE = 'Some links are affiliate links; I may earn a commission.';
const AMAZON_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';
// Amazon by hostname: amazon.<tld> (amazon.com, amazon.co.uk, amazon.com.au)
// and its subdomains, and Amazon's short links. Never a substring match.
const AMAZON_HOST_RE = /(^|\.)amazon\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;
const AMAZON_SHORT_HOSTS = new Set(['amzn.to', 'amzn.eu', 'a.co']);
const CAPTION_MAX = 2200;
const KEY = 'style_sheet';
const SITE_KEY_RE = /^[A-Za-z0-9_-]{12}$/;
const PUBLIC_LIST_MAX = 50;

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

function isAmazonUrl(url) {
  let host;
  try { host = new URL(String(url || '')).hostname.toLowerCase(); } catch { /* silent-ok: an address that does not parse is not an Amazon link */
    return false;
  }
  return AMAZON_SHORT_HOSTS.has(host) || AMAZON_HOST_RE.test(host);
}

/**
 * The locked disclosure for the included links, or null with none: the
 * affiliate sentence, then the Amazon sentence when any link is Amazon's.
 */
function disclosureFor(links) {
  if (!links.length) return null;
  return links.some((l) => isAmazonUrl(l.url)) ? `${DISCLOSURE} ${AMAZON_DISCLOSURE}` : DISCLOSURE;
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
  const disclosure = disclosureFor(included);
  const outOfDate = sheet.status !== 'approved' || sheet.stale || sheet.inputs_hash !== entry.sheet_hash;
  return {
    sent: true,
    sent_at: entry.sent_at,
    sent_by: entry.sent_by || null,
    out_of_date: outOfDate,
    items: (entry.items || []).filter((i) => EXPORTS[i.size]).map((i) => ({
      ...i, path: `/api/v1/episodes/${episodeId}/style-sheet/export/${i.size}`,
    })),
    designs: designsView(episodeId, entry),
    caption: entry.caption || '',
    caption_max: CAPTION_MAX,
    include_shop_links: Boolean(entry.include_shop_links),
    shop_links: links,
    disclosure,
    disclosure_locked: Boolean(disclosure),
    post_text: postText(entry.caption || '', included, disclosure),
    site: siteView(entry),
  };
}

/**
 * Evoni's five designs (2026-10-22), each in the six sizes, as sent. The
 * caption, the Shop the Look links and their disclosure go with them as
 * with the sheet: one post text for the whole set.
 */
function designItems(sheet) {
  const { DESIGNS, SIZES } = require('./styleSheetDesigns');
  const { designFilename } = require('./styleSheetService');
  return DESIGNS.map((d) => ({
    design: d.key,
    name: d.name,
    sizes: Object.entries(SIZES).map(([size, z]) => ({ size, label: z.label, width: z.width, height: z.height, filename: designFilename(sheet, d.key, size) })),
  }));
}

function designsView(episodeId, entry) {
  const { DESIGNS, SIZES } = require('./styleSheetDesigns');
  return (Array.isArray(entry.designs) ? entry.designs : [])
    .filter((d) => d && DESIGNS.some((x) => x.key === d.design))
    .map((d) => ({
      ...d,
      sizes: (d.sizes || []).filter((z) => SIZES[z.size]).map((z) => ({ ...z, path: `/api/v1/episodes/${episodeId}/style-sheet/design/${d.design}/${z.size}` })),
    }));
}

/** The website state of a sent sheet, as the Distribution card shows it. */
function siteView(entry) {
  const site = isObject(entry.site) ? entry.site : null;
  if (!site || !site.key) return { published: false };
  return {
    published: true,
    published_at: site.published_at || null,
    key: site.key,
    path: `/shop-the-look/${site.key}`,
    showing: Boolean(entry.include_shop_links) && (site.piece_ids || []).length > 0,
    // The look strip (Task #3120): on the site, failed to copy, or none (no bucket, or a look sent since).
    image: site.image?.key ? 'on_site' : (site.image?.failed ? 'failed' : 'none'),
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
    designs: designItems(sheet),
    caption: keepCaption ? previous.caption : captionDraft(sheet),
    caption_edited: Boolean(keepCaption),
    include_shop_links: Boolean(includeShopLinks),
  };
  // Published stays published, now with the look just approved; an image of
  // another look is dropped until she publishes again (Task #3120).
  if (previous && isObject(previous.site) && previous.site.key) {
    entry.site = { ...previous.site, piece_ids: sheet.wardrobe_piece_ids || [] };
    if (isObject(entry.site.image) && entry.site.image.sheet_hash !== sheet.inputs_hash) delete entry.site.image;
  }
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

/**
 * The look strip copied to the public site bucket: { key, sheet_hash }, or
 * { failed: true, sheet_hash } when it cannot be drawn or stored, or null
 * without SITE_PUBLIC_BUCKET (text only).
 */
async function copyLookImage(models, episodeId, siteKey, sheetHash) {
  const slots = require('./websiteSlotService');
  const cfg = slots.storageConfig();
  if (!cfg) return null;
  try {
    const out = await module.exports.drawLook(models, episodeId);
    const key = `${cfg.prefix}/looks/${siteKey}/${crypto.randomUUID()}.png`;
    await slots.putObject(cfg, key, out.buffer, 'image/png');
    return { key, sheet_hash: sheetHash || null };
  } catch (err) {
    console.error(`[StyleSheetDistribution] the look image of episode ${episodeId} could not be copied to the public site:`, err.message);
    return { failed: true, sheet_hash: sheetHash || null };
  }
}

/** The look's public image { url, alt }, or null. */
function publicImageOf(site, title) {
  const image = isObject(site.image) ? site.image : null;
  if (!image?.key) return null;
  const url = require('./websiteSlotService').publicUrl(image.key);
  return url ? { url, alt: `The look: ${title}` } : null;
}

/**
 * Show the sent sheet's Shop the Look on the website (Evoni, 2026-10-12:
 * only when she publishes it). Needs the links included and at least one
 * piece with a link. Publishing again keeps the look's public key.
 */
async function publishStyleSheetToSite(models, episodeId, user = null) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? { ...metadata[KEY] } : null;
  if (!entry) throw new LookbookError('Send the style sheet to Distribution before putting it on the website.', 404, 'NOT_SENT');
  if (!entry.include_shop_links) throw new LookbookError('Include the Shop the Look links before putting the look on the website.', 409, 'NO_SHOP_LINKS');
  const sheet = await sheetFor(models, episodeId);
  if (!(await shopLinks(models, sheet)).length) {
    throw new LookbookError("None of the look's pieces has a real-world link yet.", 409, 'NO_LINKS');
  }
  const previous = isObject(entry.site) ? entry.site : {};
  entry.site = {
    published_at: new Date().toISOString(),
    published_by: user ? String(user.email || user.id || user.sub || '').slice(0, 255) || null : null,
    key: SITE_KEY_RE.test(previous.key || '') ? previous.key : crypto.randomBytes(9).toString('base64url'),
    piece_ids: sheet.wardrobe_piece_ids || [],
  };
  const image = await copyLookImage(models, episodeId, entry.site.key, sheet.inputs_hash);
  if (image) entry.site.image = image;
  await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  return view(models, episodeId, entry, sheet);
}

/** Take the look off the website; the sheet stays in Distribution. */
async function takeDownStyleSheetFromSite(models, episodeId) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? { ...metadata[KEY] } : null;
  if (!entry) throw new LookbookError('The style sheet has not been sent to Distribution.', 404, 'NOT_SENT');
  if (entry.site !== undefined) {
    delete entry.site;
    await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  }
  return view(models, episodeId, entry, await sheetFor(models, episodeId));
}

/**
 * The published looks, read for the public website: newest first, and only
 * those showing (links included, pieces recorded). Each is the entry, the
 * episode's number and title, and its site record. Nothing else of the
 * episode leaves here.
 */
async function publishedLooks(sequelize, { key = null } = {}) {
  // The text match narrows the scan; every hit is parsed and checked below.
  const like = key ? `%${key.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : '%published_at%';
  const rows = await sequelize.query(
    `SELECT title, episode_number, distribution_metadata FROM episodes
      WHERE deleted_at IS NULL AND distribution_metadata IS NOT NULL
        AND distribution_metadata::text LIKE :like`,
    { replacements: { like }, type: sequelize.QueryTypes.SELECT });
  const looks = [];
  for (const row of rows) {
    const entry = parseMetadata(row.distribution_metadata)[KEY];
    if (!isObject(entry) || !isObject(entry.site)) continue;
    const { site } = entry;
    if (!SITE_KEY_RE.test(site.key || '') || (key && site.key !== key)) continue;
    if (!entry.include_shop_links || !(site.piece_ids || []).length) continue;
    looks.push({ entry, site, episode: { number: row.episode_number ?? null, title: text(row.title) } });
  }
  looks.sort((a, b) => String(b.site.published_at || '').localeCompare(String(a.site.published_at || '')));
  return looks.slice(0, PUBLIC_LIST_MAX);
}

const lookTitle = (episode) => {
  const n = episode.number != null ? `Episode ${episode.number}` : null;
  return [n, episode.title].filter(Boolean).join(': ') || 'Shop the Look';
};

/** The website's list: each published look's key, title, date and image. */
async function listPublicLooks(models) {
  return (await publishedLooks(models.sequelize)).map(({ site, episode }) => ({
    key: site.key, title: lookTitle(episode), published_at: site.published_at || null,
    image: publicImageOf(site, lookTitle(episode)),
  }));
}

/**
 * One published look for the website, or null: its title, its image (the
 * look strip in the public bucket, or null), her caption, the
 * links (label, retailer, url, affiliate), read live from its pieces, and
 * the disclosure first (disclosureFor; a published look has links). No ids,
 * no prices.
 */
async function publicLook(models, key) {
  if (!SITE_KEY_RE.test(String(key || ''))) return null;
  const [look] = await publishedLooks(models.sequelize, { key });
  if (!look) return null;
  const links = await shopLinks(models, { wardrobe_piece_ids: look.site.piece_ids });
  if (!links.length) return null;
  const title = lookTitle(look.episode);
  return {
    key: look.site.key,
    title,
    published_at: look.site.published_at || null,
    image: publicImageOf(look.site, title),
    caption: text(look.entry.caption) || '',
    disclosure: disclosureFor(links),
    links: links.map((l) => ({ label: l.label, retailer: l.retailer, url: l.url, affiliate: l.affiliate })),
  };
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
  DISCLOSURE, AMAZON_DISCLOSURE, CAPTION_MAX, isAmazonUrl, disclosureFor, captionDraft, postText, keepStyleSheet, parseMetadata,
  getStyleSheetDistribution, sendStyleSheetToDistribution, updateStyleSheetDistribution, removeStyleSheetFromDistribution,
  publishStyleSheetToSite, takeDownStyleSheetFromSite, listPublicLooks, publicLook,
  // The look strip, drawn as the export (styleSheetService); here so a test can stand in for the drawing.
  drawLook: (models, episodeId) => require('./styleSheetService').exportStyleSheet(models, episodeId, 'look'),
};
