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
async function keepStyleSheet(sequelize, episodeId, incoming, { transaction = null } = {}) {
  const next = { ...parseMetadata(incoming) };
  delete next[KEY];
  // Read in the caller's transaction when it has one (the episode save locks the row).
  const [[row]] = await sequelize.query(
    'SELECT distribution_metadata FROM episodes WHERE id = :id', { replacements: { id: episodeId }, transaction });
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
 * The locked disclosure for the included links, or null when none of them
 * is an affiliate link: the affiliate sentence, then the Amazon sentence
 * when an affiliate link is Amazon's.
 */
function disclosureFor(links) {
  // Only an affiliate link is disclosed as one (Evoni, 2026-11-15): a plain shopping link earns nothing and
  // says nothing. This is the affiliate disclosure alone; a sponsorship, a gift or a paid placement is a
  // different statement and is not made here. The Dream Cities' brand deals are fiction and are never disclosed
  // as real ones.
  const affiliate = links.filter((l) => l.affiliate);
  if (!affiliate.length) return null;
  return affiliate.some((l) => isAmazonUrl(l.url)) ? `${DISCLOSURE} ${AMAZON_DISCLOSURE}` : DISCLOSURE;
}

// ── The published snapshot (Evoni, 2026-11-15) ─────────────────────────────
// What the website shows of a look is what she confirmed when she published
// it, saved in the entry's `site` record: each piece of the look with its
// real brand, real product name, retailer, https address, whether the link
// is an affiliate's, whether the product is the piece itself or a similar
// one, and whether it can still be bought. Nothing on the website is read
// from the wardrobe after that, so editing a piece, removing it or sending
// another look changes nothing there until she reviews and publishes again.
// The fictional name, brand and price of a piece are never in the snapshot.
const MATCHES = ['exact', 'similar'];
const LINK_TEXT_MAX = 200;
const LINK_URL_MAX = 2000;

/** An https address with a host and no sign-in in it, or null. */
function httpsUrl(value) {
  const raw = text(value);
  if (!raw || raw.length > LINK_URL_MAX) return null;
  let url;
  try { url = new URL(raw); } catch { /* silent-ok: an address that does not parse is not one to publish */
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) return null;
  return url.toString();
}

const short = (v) => { const t = text(v); return t ? t.slice(0, LINK_TEXT_MAX) : null; };

/**
 * The look's pieces as she reviews them before publishing: each with what
 * the wardrobe holds of the real product (a proposal, hers to confirm or
 * correct), and what is missing for it to be published with a link.
 * `piece` is the studio's own name for it, shown to her only.
 */
async function reviewPieces(models, sheet) {
  const ids = (sheet.wardrobe_piece_ids || []).filter(Boolean);
  if (!ids.length) return [];
  const rows = await models.sequelize.query(
    `SELECT id, name, clothing_category, real_brand, real_product_name, real_retailer, real_product_url, affiliate_url
       FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids }, type: models.sequelize.QueryTypes.SELECT });
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean).map((r) => {
    const affiliate = text(r.affiliate_url);
    const url = affiliate || text(r.real_product_url);
    const missing = [];
    if (!text(r.real_brand)) missing.push('real_brand');
    if (!text(r.real_product_name)) missing.push('real_product_name');
    if (!text(r.real_retailer)) missing.push('retailer');
    if (!url) missing.push('url');
    else if (!httpsUrl(url)) missing.push('https_url');
    return {
      piece_id: r.id, piece: text(r.name), category: text(r.clothing_category),
      real_brand: text(r.real_brand), real_product_name: text(r.real_product_name), retailer: text(r.real_retailer),
      url: url || null, affiliate: Boolean(affiliate), missing,
    };
  });
}

/**
 * The snapshot of what she confirmed: one entry per piece of the look, in
 * the look's order. A piece she confirmed with every detail is `available`;
 * a piece she left out is `unavailable` (shown, with no link). Throws
 * LINKS_NOT_CONFIRMED naming each piece and what is wrong with it.
 */
function snapshotLinks(pieces, confirmed) {
  if (!Array.isArray(confirmed)) {
    throw new LookbookError('Review and confirm the look\'s real products before putting it on the website.', 400, 'LINKS_NOT_CONFIRMED');
  }
  const known = new Map(pieces.map((p) => [String(p.piece_id), p]));
  const given = new Map();
  const problems = [];
  for (const c of confirmed) {
    const id = String(c?.piece_id || '');
    if (!known.has(id)) { problems.push({ piece_id: id || null, problems: ['not_in_look'] }); continue; }
    if (given.has(id)) { problems.push({ piece_id: id, problems: ['listed_twice'] }); continue; }
    given.set(id, c);
  }
  const links = pieces.map((piece) => {
    const c = given.get(String(piece.piece_id));
    const category = piece.category;
    if (!c || c.available === false) {
      // Shown without a link. Named by the real product when she gives one, else by what kind of piece it is.
      return {
        piece_id: piece.piece_id, category, real_brand: short(c?.real_brand), real_product_name: short(c?.real_product_name),
        retailer: null, url: null, affiliate: false, match: MATCHES.includes(c?.match) ? c.match : null, status: 'unavailable',
      };
    }
    const wrong = [];
    const url = httpsUrl(c.url);
    if (c.confirmed !== true) wrong.push('not_confirmed');
    if (!short(c.real_brand)) wrong.push('real_brand');
    if (!short(c.real_product_name)) wrong.push('real_product_name');
    if (!short(c.retailer)) wrong.push('retailer');
    if (!url) wrong.push('https_url');
    if (!MATCHES.includes(c.match)) wrong.push('match');
    if (typeof c.affiliate !== 'boolean') wrong.push('affiliate');
    if (wrong.length) problems.push({ piece_id: piece.piece_id, problems: wrong });
    return {
      piece_id: piece.piece_id, category, real_brand: short(c.real_brand), real_product_name: short(c.real_product_name),
      retailer: short(c.retailer), url, affiliate: c.affiliate === true, match: c.match, status: 'available',
    };
  });
  if (problems.length) {
    const err = new LookbookError('Each product needs its real brand, product name, retailer, an https address, whether it is the piece or a similar one, and your confirmation.', 400, 'LINKS_NOT_CONFIRMED');
    err.details = { pieces: problems };
    throw err;
  }
  return links;
}

const CATEGORY_WORDS = { dress: 'Dress', top: 'Top', bottom: 'Bottom', outerwear: 'Outerwear', shoes: 'Shoes', jewelry: 'Jewelry', bag: 'Bag', accessory: 'Accessory', accessories: 'Accessory', hair: 'Hair', perfume: 'Fragrance' };
/** What the website calls a snapshot entry: its real brand and product, else the kind of piece. Never the studio's name for it. */
const snapshotLabel = (l) => [text(l.real_brand), text(l.real_product_name)].filter(Boolean).join(' ')
  || CATEGORY_WORDS[String(l.category || '').toLowerCase()] || 'Piece';
const buyable = (links) => (links || []).filter((l) => l.status === 'available' && l.url);

/** A snapshot entry as the website gives it: no ids. */
const publicLink = (l) => ({
  label: snapshotLabel(l), retailer: l.status === 'available' ? (l.retailer || null) : null,
  url: l.status === 'available' ? l.url : null, affiliate: l.status === 'available' && Boolean(l.affiliate),
  match: l.match || null, available: l.status === 'available' && Boolean(l.url),
});

/**
 * How a published look now differs from what Distribution holds: the look's
 * pieces, a product's details in the wardrobe, or the sheet its image was
 * drawn from. Empty when nothing does. A look published before snapshots
 * has none to compare and says so.
 */
function siteDiffers(site, sheet, pieces) {
  if (!Array.isArray(site.links)) return ['no_snapshot'];
  const out = [];
  const now = (sheet.wardrobe_piece_ids || []).map(String);
  const then = site.links.map((l) => String(l.piece_id));
  if (now.length !== then.length || now.some((id, i) => id !== then[i])) out.push('pieces');
  const byId = new Map(pieces.map((p) => [String(p.piece_id), p]));
  const changed = site.links.some((l) => {
    const p = byId.get(String(l.piece_id));
    if (!p) return false;   // gone from the look or the wardrobe: 'pieces' says so
    if (l.status !== 'available' || l.match !== 'exact') return false;   // hers to change, not the wardrobe's
    return (p.url || null) !== (l.url || null) && httpsUrl(p.url) !== l.url;
  });
  if (changed) out.push('links');
  if (isObject(site.image) && site.image.sheet_hash && site.image.sheet_hash !== sheet.inputs_hash) out.push('image');
  return out;
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
  const pieces = await reviewPieces(models, sheet);
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
    site: siteView(entry, await episodeReleased(models, episodeId), sheet, pieces),
    // What she reviews before publishing: each piece of the look and its real product, as the wardrobe has it.
    site_review: pieces,
  };
}

/**
 * Evoni's five designs (2026-10-22), each in the six sizes, as sent. The
 * caption, the Shop the Look links and their disclosure go with them as
 * with the sheet: one post text for the whole set.
 */
function designItems(sheet) {
  const { SIZES } = require('./styleSheetDesigns');
  const { designFilename } = require('./styleSheetService');
  // The designs on for the show (Template Studio › Style sheets).
  return (sheet.designs || []).map((d) => ({
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
function siteView(entry, released = false, sheet = null, pieces = []) {
  const site = isObject(entry.site) ? entry.site : null;
  if (!site || !site.key) return { published: false };
  return {
    // What is on the website (the snapshot), and how Distribution now differs from it: review and publish again to update.
    links: Array.isArray(site.links) ? site.links.map((l) => ({ ...l, label: snapshotLabel(l), available: publicLink(l).available })) : null,
    disclosure: site.disclosure || null,
    confirmed_at: site.confirmed_at || null,
    differs: sheet ? siteDiffers(site, sheet, pieces) : [],
    published: true,
    // The website shows a look only once its episode is released (releasedOn); until then it waits.
    released: Boolean(released),
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
  // Published stays published, exactly as she published it (Evoni, 2026-11-15): sending another look
  // changes nothing on the website. The card says the two differ until she reviews and publishes again.
  if (previous && isObject(previous.site) && previous.site.key) entry.site = previous.site;
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
async function publishStyleSheetToSite(models, episodeId, user = null, { links: confirmed } = {}) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? { ...metadata[KEY] } : null;
  if (!entry) throw new LookbookError('Send the style sheet to Distribution before putting it on the website.', 404, 'NOT_SENT');
  if (!entry.include_shop_links) throw new LookbookError('Include the Shop the Look links before putting the look on the website.', 409, 'NO_SHOP_LINKS');
  const sheet = await sheetFor(models, episodeId);
  const pieces = await reviewPieces(models, sheet);
  if (!pieces.some((p) => p.url)) {
    throw new LookbookError("None of the look's pieces has a real-world link yet.", 409, 'NO_LINKS');
  }
  // Only what she confirmed is published: nothing is taken from the wardrobe unseen, and no address is made up.
  const links = snapshotLinks(pieces, confirmed);
  if (!buyable(links).length) {
    throw new LookbookError('Confirm at least one product with a link.', 409, 'NO_LINKS');
  }
  const previous = isObject(entry.site) ? entry.site : {};
  const who = user ? String(user.email || user.id || user.sub || '').slice(0, 255) || null : null;
  const at = new Date().toISOString();
  entry.site = {
    published_at: at,
    published_by: who,
    key: SITE_KEY_RE.test(previous.key || '') ? previous.key : crypto.randomBytes(9).toString('base64url'),
    piece_ids: links.map((l) => l.piece_id),
    links,
    disclosure: disclosureFor(buyable(links)),
    confirmed_at: at,
    confirmed_by: who,
    sheet_hash: sheet.inputs_hash,
  };
  const image = await copyLookImage(models, episodeId, entry.site.key, sheet.inputs_hash);
  // A copy that could not be made keeps the image the website already shows of this look.
  if (image && image.key) entry.site.image = image;
  else if (isObject(previous.image) && previous.image.key) entry.site.image = previous.image;
  else if (image) entry.site.image = image;
  await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  return view(models, episodeId, entry, sheet);
}

/**
 * A product of the published look can no longer be bought, or can again:
 * hers to say, on the snapshot only. The look stays up; the piece stays
 * shown, without its link while it is unavailable.
 */
async function setPublishedLinkAvailability(models, episodeId, { pieceId, available } = {}) {
  if (typeof available !== 'boolean') throw new LookbookError('available is true or false.', 400, 'BAD_AVAILABLE');
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? { ...metadata[KEY] } : null;
  if (!entry || !isObject(entry.site) || !entry.site.key) throw new LookbookError('This look is not on the website.', 404, 'NOT_PUBLISHED');
  if (!Array.isArray(entry.site.links)) {
    throw new LookbookError('This look was published before products were confirmed; review and publish it again first.', 409, 'NO_SNAPSHOT');
  }
  const index = entry.site.links.findIndex((l) => String(l.piece_id) === String(pieceId || ''));
  if (index < 0) throw new LookbookError('That piece is not in the published look.', 404, 'PIECE_NOT_PUBLISHED');
  const link = entry.site.links[index];
  // Only a product she confirmed with a link can be bought again; a piece published without one needs a review.
  if (available && !(link.url && link.retailer)) {
    throw new LookbookError('This piece was published without a product; review and publish the look again to add one.', 409, 'NO_PRODUCT');
  }
  const links = entry.site.links.map((l, i) => (i === index ? { ...l, status: available ? 'available' : 'unavailable' } : l));
  entry.site = { ...entry.site, links, disclosure: disclosureFor(buyable(links)) };
  await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  return view(models, episodeId, entry, await sheetFor(models, episodeId));
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
 * Is this episode released to the public: published, and its "after the
 * episode" moment no later than its show's present (services/storyClock,
 * the rule The Pulse reads by)? An episode with no number has no moment and
 * is not. `present` remembers each show's present for one read.
 */
async function releasedOn(models, episode, present = new Map()) {
  if (!episode || episode.status !== 'published' || !episode.show_id) return false;
  const clock = require('./storyClock');
  const order = clock.orderOf(episode.episode_number, 'after_episode');
  if (!Number.isInteger(order)) return false;
  if (!present.has(episode.show_id)) present.set(episode.show_id, await clock.presentOrder(models, episode.show_id));
  return order <= present.get(episode.show_id);
}

/** The same, for an episode by its id (the Distribution card says whether the website shows the look yet). */
async function episodeReleased(models, episodeId) {
  const [row] = await models.sequelize.query(
    'SELECT show_id, status, episode_number FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, type: models.sequelize.QueryTypes.SELECT });
  return releasedOn(models, row);
}

/**
 * The published looks, read for the public website: newest first, and only
 * those of a released episode (releasedOn) that are showing (links included, pieces recorded). Each is the entry, the
 * episode's number and title, and its site record. Nothing else of the
 * episode leaves here.
 */
async function publishedLooks(models, { key = null } = {}) {
  const { sequelize } = models;
  // The text match narrows the scan; every hit is parsed and checked below.
  const like = key ? `%${key.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : '%published_at%';
  const rows = await sequelize.query(
    `SELECT show_id, status, title, episode_number, distribution_metadata FROM episodes
      WHERE deleted_at IS NULL AND distribution_metadata IS NOT NULL
        AND distribution_metadata::text LIKE :like`,
    { replacements: { like }, type: sequelize.QueryTypes.SELECT });
  const looks = [];
  const present = new Map();
  for (const row of rows) {
    // Her switch does not release an episode: an unreleased one shows nothing here, by list or by key.
    if (!(await releasedOn(models, row, present))) continue;
    const entry = parseMetadata(row.distribution_metadata)[KEY];
    if (!isObject(entry) || !isObject(entry.site)) continue;
    const { site } = entry;
    if (!SITE_KEY_RE.test(site.key || '') || (key && site.key !== key)) continue;
    // A look she confirmed shows what she confirmed (an archive when nothing can be bought any more).
    // One published before that needs the links on and its pieces, as it always did.
    // Her links switch hides either kind.
    if (!entry.include_shop_links) continue;
    if (!(Array.isArray(site.links) ? site.links : (site.piece_ids || [])).length) continue;
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
  return (await publishedLooks(models)).map(({ site, episode }) => ({
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
  const [look] = await publishedLooks(models, { key });
  if (!look) return null;
  const title = lookTitle(look.episode);
  const base = {
    key: look.site.key,
    title,
    published_at: look.site.published_at || null,
    image: publicImageOf(look.site, title),
    caption: text(look.entry.caption) || '',
  };
  if (Array.isArray(look.site.links)) {
    // The snapshot: every piece, the ones that can no longer be bought shown without a link. Never a 404 for that.
    const links = look.site.links.map(publicLink);
    return { ...base, disclosure: disclosureFor(buyable(look.site.links)), links, archive: !links.some((l) => l.available) };
  }
  // Published before snapshots: read from its pieces as it was, until she reviews and publishes it again.
  const links = await shopLinks(models, { wardrobe_piece_ids: look.site.piece_ids });
  if (!links.length) return null;
  return {
    ...base,
    disclosure: disclosureFor(links),
    links: links.map((l) => ({ label: l.label, retailer: l.retailer, url: l.url, affiliate: l.affiliate, match: null, available: true })),
    archive: false,
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
  publishStyleSheetToSite, takeDownStyleSheetFromSite, setPublishedLinkAvailability, listPublicLooks, publicLook,
  httpsUrl, snapshotLinks, MATCHES,
  // The look strip, drawn as the export (styleSheetService); here so a test can stand in for the drawing.
  drawLook: (models, episodeId) => require('./styleSheetService').exportStyleSheet(models, episodeId, 'look'),
};
