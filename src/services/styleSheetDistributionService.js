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

/**
 * Save the record. The entry is read, changed and written by several
 * actions (send, publish, withdraw, take down, a check), and two of them can
 * overlap. The write locks the episode's row, and then:
 *
 *   - Stale writes are refused (Evoni, 2026-11-16). The entry carries a
 *     revision number (`rev`), raised by every save. An action saves only if
 *     the stored entry is still at the revision it read; otherwise something
 *     else has saved since, and this action's entry, built from what it read,
 *     is not written: 409 DISTRIBUTION_CHANGED, and she reloads. So one
 *     action can no longer overwrite another's products, declaration or image
 *     with an older picture of the look.
 *   - No public copy is lost by that. A refused publish may already have put
 *     its image in the public bucket, and a refused check or withdrawal may
 *     have learned of a copy; before refusing, what the stale action knew of
 *     public copies is added to the stored entry (keepPublicCopies), as
 *     pending.
 *   - Removing the entry is refused, under the same lock, while a copy's
 *     access is not known to be gone.
 *   - The revision outlives the entry (Evoni, 2026-11-16). Removing the entry
 *     leaves its next revision in the metadata (`style_sheet_rev`), and every
 *     later save is compared with it. So an action that read the entry before
 *     it was removed is stale, and cannot bring the entry back; a new send,
 *     which reads the kept revision, can.
 *
 * Returns the revision saved.
 */
const REV_KEY = `${KEY}_rev`;
const revOf = (e) => (isObject(e) && Number.isInteger(e.rev) ? e.rev : 0);
/** The revision a reader of this metadata must save against: the entry's, or the one kept when it was removed. */
const revisionIn = (metadata) => (isObject(metadata[KEY]) ? revOf(metadata[KEY]) : (Number.isInteger(metadata[REV_KEY]) ? metadata[REV_KEY] : 0));

async function writeMetadata(models, episodeId, metadata, { removing = null } = {}) {
  let stale = false;
  let saved = null;
  await models.sequelize.transaction(async (transaction) => {
    const [[row]] = await models.sequelize.query(
      'SELECT distribution_metadata FROM episodes WHERE id = :id AND deleted_at IS NULL FOR UPDATE',
      { replacements: { id: episodeId }, transaction });
    const storedAll = row ? parseMetadata(row.distribution_metadata) : {};
    const stored = isObject(storedAll[KEY]) ? storedAll[KEY] : null;
    const current = revisionIn(storedAll);
    const next = { ...metadata };
    const save = (value) => models.Episode.update({ distribution_metadata: value }, { where: { id: episodeId, deleted_at: null }, transaction });
    if (!isObject(next[KEY])) {
      // Already removed by something else: there is nothing to remove, and nothing is written.
      if (!stored) { saved = current; return; }
      // A removal built on an older reading is stale too: the entry it meant to remove is not the one stored.
      if (revOf(stored) !== revOf(removing)) { stale = true; return; }
      if (hasUnrevokedCopy(stored)) {
        throw new LookbookError('This look has a public image copy whose access is not yet known to be removed. Take the look down and check the copy first.', 409, 'PUBLIC_COPIES_PENDING');
      }
      saved = current + 1;
      await save({ ...next, [REV_KEY]: saved });
      return;
    }
    if (revOf(next[KEY]) !== current) {
      // Something else saved since this action read, or removed the entry. What is stored stands; a removed entry
      // stays removed. Only the public copies this action knew of are added to an entry that is still there.
      stale = true;
      if (stored) {
        const kept = keepPublicCopies(next[KEY], stored);
        if (JSON.stringify(kept.public_copies || []) !== JSON.stringify(stored.public_copies || [])) {
          await save({ ...storedAll, [KEY]: { ...kept, rev: current + 1 } });
        }
      }
      return;
    }
    saved = current + 1;
    const value = { ...next, [KEY]: { ...keepPublicCopies(stored, next[KEY]), rev: saved } };
    delete value[REV_KEY];
    await save(value);
  });
  if (stale) {
    throw new LookbookError('This look was changed by something else while this was being saved. Reload it and try again.', 409, 'DISTRIBUTION_CHANGED');
  }
  return saved;
}

/**
 * For the other Distribution writers (the tab's Save, Generate, the episode
 * update): what they save, with the style sheet entry carried over from the
 * stored record, or the revision kept in its place. Both are only ever
 * written by this service; neither can be sent in.
 */
async function keepStyleSheet(sequelize, episodeId, incoming, { transaction = null } = {}) {
  const next = { ...parseMetadata(incoming) };
  delete next[KEY];
  delete next[REV_KEY];
  // Read in the caller's transaction when it has one (the episode save locks the row).
  const [[row]] = await sequelize.query(
    'SELECT distribution_metadata FROM episodes WHERE id = :id', { replacements: { id: episodeId }, transaction });
  const all = row ? parseMetadata(row.distribution_metadata) : {};
  if (all[KEY]) next[KEY] = all[KEY];
  // And the revision kept when the entry was removed: without it a save built on the removed entry would pass.
  else if (Number.isInteger(all[REV_KEY])) next[REV_KEY] = all[REV_KEY];
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
function siteDiffers(site, sheet, pieces, entryCaption = null) {
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
  if (typeof site.caption === 'string' && typeof entryCaption === 'string' && site.caption !== entryCaption) out.push('caption');
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
    // Copies in the public bucket that are no longer shown, and whether access to each is known to be gone.
    public_copies: (Array.isArray(entry.public_copies) ? entry.public_copies : []).map(copyView),
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
    differs: sheet ? siteDiffers(site, sheet, pieces, text(entry.caption) || '') : [],
    published: true,
    // The website shows a look only once its episode is released (releasedOn); until then it waits.
    released: Boolean(released),
    published_at: site.published_at || null,
    key: site.key,
    path: `/shop-the-look/${site.key}`,
    showing: Boolean(entry.include_shop_links) && (site.piece_ids || []).length > 0,
    // The look strip (Task #3120): on the site, failed to copy, or none (no bucket, or a look sent since).
    // on the site (she cleared this very image), not cleared (no declaration, or "unknown": text only),
    // failed to copy, or none (no bucket).
    image: imageCleared(site) ? 'on_site'
      : (isObject(site.image_rights) && site.image_rights.withdrawn ? 'withdrawn'
        : (!isObject(site.image_rights) || !site.image_rights.cleared ? 'not_cleared' : (site.image?.failed ? 'failed' : 'none'))),
    // Her declaration, as saved; `stale` when the poses or the sheet have changed since she made it.
    image_rights: isObject(site.image_rights) ? {
      category: site.image_rights.category, label: IMAGE_RIGHTS[site.image_rights.category] || null, cleared: site.image_rights.cleared === true,
      note: site.image_rights.note || null, declared_by: site.image_rights.declared_by || null, declared_at: site.image_rights.declared_at || null,
      withdrawn: site.image_rights.withdrawn === true, withdrawn_at: site.image_rights.withdrawn_at || null, withdrawn_by: site.image_rights.withdrawn_by || null,
      stale: Boolean(sheet) && (!sameRefs(site.image_rights.poses, poseRefs(sheet)) || (site.image_rights.sheet_hash || null) !== (sheet.inputs_hash || null)),
    } : null,
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
    // The revision this send read: the entry's, or the one kept when the entry was removed (writeMetadata
    // refuses a save over a newer one).
    rev: revisionIn(metadata),
  };
  // Published stays published, exactly as she published it (Evoni, 2026-11-15): sending another look
  // changes nothing on the website. The card says the two differ until she reviews and publishes again.
  if (previous && isObject(previous.site) && previous.site.key) entry.site = previous.site;
  if (previous && Array.isArray(previous.public_copies)) entry.public_copies = previous.public_copies;
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
 * The look image goes to the public bucket in three steps, so that no copy
 * is ever there without a record of it (Evoni, 2026-11-16):
 *
 *   1. it is drawn (nothing is stored yet);
 *   2. its exact object key is reserved on the entry's `public_copies`,
 *      under the row lock and the revision check (reserveLookImage). If the
 *      entry has changed or been removed, this is refused and nothing is
 *      copied;
 *   3. only then is it stored under that key (storeLookImage).
 *
 * drawLookImage returns { cfg, buffer }, or { failed: true } when it cannot
 * be drawn, or null without SITE_PUBLIC_BUCKET (text only).
 */
async function drawLookImage(models, episodeId) {
  const slots = require('./websiteSlotService');
  const cfg = slots.storageConfig();
  if (!cfg) return null;
  try {
    const out = await module.exports.drawLook(models, episodeId);
    return { cfg, buffer: out.buffer };
  } catch (err) {
    console.error(`[StyleSheetDistribution] the look image of episode ${episodeId} could not be copied to the public site:`, err.message);
    return { failed: true };
  }
}

/** true when the object was stored; false when the storage refused or could not be reached (it may or may not be there). */
async function storeLookImage(cfg, key, buffer, episodeId) {
  try {
    await require('./websiteSlotService').putObject(cfg, key, buffer, 'image/png');
    return true;
  } catch (err) {
    console.error(`[StyleSheetDistribution] the look image of episode ${episodeId} could not be copied to the public site:`, err.message);
    return false;
  }
}

// ── The look image's rights (Evoni, 2026-11-15) ────────────────────────────
// The look image goes to the public bucket only when she has declared, at
// that publish, that this exact image may be shown: one of four cleared
// categories. "Unknown / not cleared", or no declaration, publishes the
// look as text and links; the image is not copied and not served. An image
// made by AI or taken from a retailer is not cleared by being so: she says
// the intended use is permitted. The declaration is hers, recorded with
// who and when; it is not a check of ownership or of any licence.
//
// It is bound to what it was made about: the front, side and back poses the
// image is drawn from (their ids and addresses), the sheet's hash, and the
// copy in the public bucket. The website shows an image only while its
// declaration names that very copy. A new pose, a redrawn sheet or another
// publish makes a new image, which needs its own declaration.
const IMAGE_RIGHTS = {
  original: 'Original photograph — owned or controlled',
  licensed: 'Licensed image — permission held',
  retailer: 'Retailer image — permission held',
  ai_cleared: 'AI-generated image — cleared for public use',
  unknown: 'Unknown / not cleared',
};
const CLEARED_RIGHTS = ['original', 'licensed', 'retailer', 'ai_cleared'];
const RIGHTS_NOTE_MAX = 500;

/** The poses the look image is drawn from, as the sheet has them: { front, side, back }, each { id, url } or null. */
function poseRefs(sheet) {
  const from = isObject(sheet.look_from_files) ? sheet.look_from_files : {};
  const ref = (p) => (isObject(p) && (p.id || p.url) ? { id: p.id || null, url: text(p.url) } : null);
  return { front: ref(from.front), side: ref(from.side), back: ref(from.back) };
}
// Compared field by field: the stored record comes back from the database with its keys in another order.
const sameRefs = (a, b) => ['front', 'side', 'back'].every((angle) => {
  const x = isObject(a) && isObject(a[angle]) ? a[angle] : null;
  const y = isObject(b) && isObject(b[angle]) ? b[angle] : null;
  if (!x || !y) return x === y;
  return String(x.id || '') === String(y.id || '') && (x.url || null) === (y.url || null);
});

/**
 * Her declaration as sent with a publish: { category, note? }. Returns the
 * record to save (without the image it will be bound to), or null when she
 * sent none. Throws BAD_IMAGE_RIGHTS for anything that is not one of the
 * five categories.
 */
function readImageRights(body, sheet, who, at) {
  if (body === undefined || body === null) return null;
  if (!isObject(body) || !Object.prototype.hasOwnProperty.call(IMAGE_RIGHTS, body.category)) {
    throw new LookbookError(`Say what the look image is: one of ${Object.keys(IMAGE_RIGHTS).join(', ')}.`, 400, 'BAD_IMAGE_RIGHTS');
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    throw new LookbookError('The permission note is text.', 400, 'BAD_IMAGE_RIGHTS');
  }
  if (typeof body.note === 'string' && body.note.length > RIGHTS_NOTE_MAX) {
    throw new LookbookError(`The permission note is at most ${RIGHTS_NOTE_MAX} characters.`, 400, 'BAD_IMAGE_RIGHTS');
  }
  return {
    category: body.category,
    cleared: CLEARED_RIGHTS.includes(body.category),
    // Where the permission is held (a licence, an email, a retailer's programme): hers to fill, never public.
    note: text(body.note),
    declared_by: who,
    declared_at: at,
    sheet_hash: sheet.inputs_hash || null,
    poses: poseRefs(sheet),
  };
}

/** May the website show this site record's image: a cleared declaration that names this very copy? */
function imageCleared(site) {
  const image = isObject(site.image) ? site.image : null;
  const rights = isObject(site.image_rights) ? site.image_rights : null;
  if (!image?.key || !rights) return false;
  return rights.cleared === true && CLEARED_RIGHTS.includes(rights.category)
    && rights.image_key === image.key && (rights.sheet_hash || null) === (image.sheet_hash || null);
}

// ── Public copies that are no longer shown (Evoni, 2026-11-15) ─────────────
// When an image stops being shown (she withdraws its rights, publishes the
// look again, or takes it down), the website's API stops giving its address
// at once. The copy itself stays in the public bucket: nothing here deletes
// or moves it, and anyone who has its address can still fetch it until she
// removes access to it in the storage. So each such copy is recorded on the
// entry (`public_copies`) with its key and address, and is "pending" until
// a check of its address finds it is no longer served. It is never called
// revoked on anyone's say-so. The pose originals are other files and are
// not touched.
//
// A copy's key is reserved here before the image is stored (Evoni,
// 2026-11-16), so a record can be ahead of the object. `upload` says which:
//   'reserved'  the key is reserved; whether the object was stored is not known
//   'failed'    the storage did not confirm the upload (it may still be there)
//   absent, or 'stored': the object is known to have been stored
// A reserved or failed copy is "unconfirmed": it is not a known public copy
// awaiting revocation, and it is never called revoked. A check that finds it
// served makes it a known copy. Checks that find nothing there, twice, and
// not while its publish may still be running, mark it 'absent': no object
// was found, which is not the same as access having been removed.
const COPY_REASONS = ['rights_withdrawn', 'replaced', 'taken_down', 'reserved'];
const GONE_STATUSES = [403, 404, 410];
const RESERVATION_MINUTES = 10;
const ABSENT_CHECKS = 2;
const unconfirmed = (c) => c?.upload === 'reserved' || c?.upload === 'failed';
/** Is the publish that reserved this copy possibly still running? */
const inFlight = (c, now = Date.now()) => c?.upload === 'reserved' && now - (Date.parse(c.reserved_at || '') || 0) < RESERVATION_MINUTES * 60 * 1000;
/** Is this copy settled: access checked and gone, or (never confirmed stored) checked and not there? */
const settled = (c) => c?.revocation?.status === 'verified' || (c?.revocation?.status === 'absent' && unconfirmed(c));

/** Does this stored entry hold an image on the website, or a copy whose access is not yet known to be gone? */
function hasUnrevokedCopy(entry) {
  if (!isObject(entry)) return false;
  const pending = (Array.isArray(entry.public_copies) ? entry.public_copies : []).some((c) => !settled(c));
  return pending || Boolean(isObject(entry.site) && isObject(entry.site.image) && entry.site.image.key);
}

/**
 * The entry about to be saved, with every public copy the stored entry
 * knows of that this one does not: copies another action recorded since
 * this one read, and the image another action put on the website, if this
 * entry no longer shows it. Where both know a copy, the later check stands.
 */
function keepPublicCopies(stored, entry) {
  if (!isObject(stored)) return entry;
  const checkedAt = (c) => Date.parse(c?.revocation?.checked_at || '') || 0;
  const byKey = new Map();
  for (const c of (Array.isArray(stored.public_copies) ? stored.public_copies : [])) if (c && c.key) byKey.set(c.key, c);
  for (const c of (Array.isArray(entry.public_copies) ? entry.public_copies : [])) {
    if (!c || !c.key) continue;
    const known = byKey.get(c.key);
    if (!known || checkedAt(c) >= checkedAt(known)) byKey.set(c.key, c);
  }
  const out = { ...entry, public_copies: [...byKey.values()] };
  const shown = isObject(stored.site) && isObject(stored.site.image) ? stored.site.image : null;
  const stillShown = isObject(out.site) && isObject(out.site.image) && out.site.image.key === shown?.key;
  if (shown?.key && !stillShown) {
    recordPublicCopy(out, shown, { reason: 'replaced', who: null, at: new Date().toISOString(), rights: stored.site.image_rights });
  }
  // The image this entry shows is on the website, not on the list of copies that are not.
  const showing = isObject(out.site) && isObject(out.site.image) ? out.site.image.key : null;
  if (showing) out.public_copies = out.public_copies.filter((c) => c.key !== showing);
  if (!out.public_copies.length) delete out.public_copies;
  return out;
}

/**
 * Add a copy that is no longer shown to the entry's record, once. `image` is
 * an image that was stored and shown, so a record that only reserved its key
 * becomes a known copy.
 */
function recordPublicCopy(entry, image, { reason, who, at, rights = null } = {}) {
  if (!isObject(image) || !image.key) return;
  const list = Array.isArray(entry.public_copies) ? entry.public_copies : [];
  const known = list.find((c) => c.key === image.key);
  if (known && !unconfirmed(known)) { entry.public_copies = list; return; }
  const record = {
    key: image.key, sheet_hash: image.sheet_hash || null, reason: COPY_REASONS.includes(reason) ? reason : 'replaced',
    hidden_at: at, hidden_by: who, rights_category: rights?.category || null,
    revocation: { status: 'pending', checked_at: null, checked_by: null, last_status: null },
  };
  entry.public_copies = known ? list.map((c) => (c.key === image.key ? record : c)) : [...list, record];
}

/**
 * Reserve a look image's object key on the entry, before the image is
 * stored. A key already reserved for the same sheet whose upload was never
 * confirmed is used again, so a publish asked again does not add a record.
 * Returns the key.
 */
function reserveCopy(entry, { prefix, siteKey, sheetHash, who, at, key = null }) {
  const list = Array.isArray(entry.public_copies) ? entry.public_copies : [];
  const folder = `${prefix}/looks/${siteKey}/`;
  const again = key
    ? list.find((c) => c.key === key)
    // Any look folder: a first publish whose save failed had not yet saved the look's public key, and the next
    // try draws another; the object key reserved for the same image is still the one to use.
    : list.find((c) => unconfirmed(c) && (c.sheet_hash || null) === (sheetHash || null) && String(c.key).startsWith(`${prefix}/looks/`));
  const useKey = key || (again ? again.key : `${folder}${crypto.randomUUID()}.png`);
  const record = {
    key: useKey, sheet_hash: sheetHash || null, reason: 'reserved', upload: 'reserved',
    reserved_at: at, reserved_by: who, hidden_at: at, hidden_by: who, rights_category: null,
    revocation: { status: 'pending', checked_at: null, checked_by: null, last_status: null },
  };
  entry.public_copies = again ? list.map((c) => (c.key === useKey ? record : c)) : [...list, record];
  return useKey;
}

/** A recorded copy as Distribution shows it. `verified` only when a check of its address found it gone. */
function copyView(c) {
  const url = require('./websiteSlotService').publicUrl(c.key);
  const maybe = unconfirmed(c);
  const verified = !maybe && c.revocation?.status === 'verified';
  const absent = maybe && c.revocation?.status === 'absent';
  return {
    key: c.key, url: url || null, reason: c.reason, hidden_at: c.hidden_at || null, hidden_by: c.hidden_by || null,
    rights_category: c.rights_category || null,
    // Was the object stored? 'stored': yes, it is (or was) a public copy. 'reserved': its key was reserved for a
    // publish and the upload was not confirmed. 'failed': the storage did not confirm the upload.
    upload: maybe ? c.upload : 'stored',
    // Four separate facts: her withdrawal, the API, the object, and the check of the object.
    rights_withdrawn: c.reason === 'rights_withdrawn',
    api_hidden: true,
    // 'verified' is only ever said of a copy known to have been stored. An unconfirmed copy is 'unconfirmed'
    // until checks find nothing at its address ('absent'), which is not a revocation.
    revocation: verified ? 'verified' : absent ? 'absent' : maybe ? 'unconfirmed' : 'pending',
    checked_at: c.revocation?.checked_at || null, last_status: c.revocation?.last_status ?? null,
  };
}

/** Ask the copy's public address whether it is still served: its HTTP status, or null when it could not be asked. */
async function fetchStatus(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // No cache on our side; the CDN may still answer from its own for up to the object's lifetime, which is the point.
    const res = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: controller.signal, headers: { Range: 'bytes=0-0' } });
    return res.status;
  } catch (err) {
    console.error('[StyleSheetDistribution] a public copy could not be checked:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The look's public image { url, alt }, or null: only an image she cleared (imageCleared). */
function publicImageOf(site, title) {
  const image = isObject(site.image) ? site.image : null;
  if (!image?.key || !imageCleared(site)) return null;
  const url = require('./websiteSlotService').publicUrl(image.key);
  return url ? { url, alt: `The look: ${title}` } : null;
}

/**
 * Show the sent sheet's Shop the Look on the website (Evoni, 2026-10-12:
 * only when she publishes it). Needs the links included and at least one
 * piece with a link. Publishing again keeps the look's public key.
 */
async function publishStyleSheetToSite(models, episodeId, user = null, { links: confirmed, imageRights: declared } = {}) {
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
    // The caption as it is at this publish. The entry's caption is redrafted when another sheet is sent, and is
    // hers to edit; neither changes the published look until she publishes again.
    caption: text(entry.caption) || '',
  };
  // The image: only with her declaration that it may be shown, made at this publish. Without one, or with
  // "unknown", nothing is copied to the public bucket and the look is text and links. No earlier image or
  // declaration is carried over: each published image has its own.
  const rights = readImageRights(declared, sheet, who, at);
  if (rights) entry.site.image_rights = rights;
  // The image this publish replaces (or drops) is no longer shown, and is still in the bucket.
  recordPublicCopy(entry, previous.image, { reason: 'replaced', who, at, rights: previous.image_rights });
  if (rights && rights.cleared) {
    const sheetHash = sheet.inputs_hash || null;
    const drawn = await drawLookImage(models, episodeId);
    if (drawn && drawn.failed) entry.site.image = { failed: true, sheet_hash: sheetHash };
    else if (drawn) {
      // Reserve the object's key on the entry as it is stored now, before anything is copied. If the entry has
      // changed or been removed since it was read, this is refused (409) and no copy is made.
      const reserved = { ...metadata[KEY] };
      const key = reserveCopy(reserved, { prefix: drawn.cfg.prefix, siteKey: entry.site.key, sheetHash, who, at });
      entry.rev = await writeMetadata(models, episodeId, { ...metadata, [KEY]: reserved });
      reserveCopy(entry, { prefix: drawn.cfg.prefix, siteKey: entry.site.key, sheetHash, who, at, key });
      if (await storeLookImage(drawn.cfg, key, drawn.buffer, episodeId)) {
        // Stored: it is the image of this publish. It is shown only once the save below has it with its declaration.
        entry.site.image = { key, sheet_hash: sheetHash };
        rights.image_key = key;
        entry.public_copies = entry.public_copies.filter((c) => c.key !== key);
      } else {
        // Not confirmed: the look is text and links, and the reserved record stays, for her to check.
        entry.site.image = { failed: true, sheet_hash: sheetHash };
        entry.public_copies = entry.public_copies.map((c) => (c.key === key ? { ...c, upload: 'failed' } : c));
      }
    }
  }
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
    // Taken down, its image is no longer shown; the copy is still in the bucket.
    if (isObject(entry.site)) recordPublicCopy(entry, entry.site.image, { reason: 'taken_down', who: null, at: new Date().toISOString(), rights: entry.site.image_rights });
    delete entry.site;
    await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  }
  return view(models, episodeId, entry, await sheetFor(models, episodeId));
}

/**
 * Withdraw the image's rights from a published look, without publishing it
 * again. The look stays as it is: its products, links, disclosure and
 * dates. Its image stops being shown at once, by both public reads, and
 * its copy is recorded for her to remove access to. Asking again changes
 * nothing. Nothing is deleted or moved.
 */
async function withdrawLookImageRights(models, episodeId, user = null) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? { ...metadata[KEY] } : null;
  if (!entry || !isObject(entry.site) || !entry.site.key) throw new LookbookError('This look is not on the website.', 404, 'NOT_PUBLISHED');
  const site = { ...entry.site };
  const rights = isObject(site.image_rights) ? site.image_rights : null;
  const hasImage = isObject(site.image) && Boolean(site.image.key);
  // Already withdrawn, or never shown with an image: nothing to do, and nothing is written.
  if (!hasImage && !(rights && rights.cleared)) return view(models, episodeId, entry, await sheetFor(models, episodeId));
  const who = user ? String(user.email || user.id || user.sub || '').slice(0, 255) || null : null;
  const at = new Date().toISOString();
  if (hasImage) recordPublicCopy(entry, site.image, { reason: 'rights_withdrawn', who, at, rights });
  delete site.image;
  if (rights) {
    site.image_rights = { ...rights, cleared: false, withdrawn: true, withdrawn_at: at, withdrawn_by: who, withdrawn_category: rights.category };
  }
  entry.site = site;
  await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
  return view(models, episodeId, entry, await sheetFor(models, episodeId));
}

/**
 * Check whether a copy that is no longer shown can still be fetched at its
 * public address, and record what was found. Only a check that finds it
 * gone (403, 404 or 410) marks it verified; anything else, a copy with no
 * public address, or a check that could not be made, leaves it pending. A
 * copy found reachable again after being verified goes back to pending.
 */
async function checkPublicCopy(models, episodeId, user = null, { key } = {}) {
  const metadata = await readMetadata(models.sequelize, episodeId);
  const entry = isObject(metadata[KEY]) ? { ...metadata[KEY] } : null;
  if (!entry) throw new LookbookError('The style sheet has not been sent to Distribution.', 404, 'NOT_SENT');
  const list = Array.isArray(entry.public_copies) ? entry.public_copies : [];
  const index = list.findIndex((c) => c.key === key);
  if (typeof key !== 'string' || index < 0) throw new LookbookError('That is not a copy this look has stopped showing.', 404, 'COPY_NOT_FOUND');
  const url = require('./websiteSlotService').publicUrl(list[index].key);
  const status = url ? await module.exports.fetchStatus(url) : null;
  const gone = GONE_STATUSES.includes(status);
  const who = user ? String(user.email || user.id || user.sub || '').slice(0, 255) || null : null;
  const checkedAt = new Date().toISOString();
  entry.public_copies = list.map((c, i) => {
    if (i !== index) return c;
    if (!unconfirmed(c)) {
      return { ...c, revocation: { status: gone ? 'verified' : 'pending', checked_at: checkedAt, checked_by: who, last_status: status } };
    }
    // A copy whose upload was never confirmed. Served: it is there, and is now a known public copy.
    if (status !== null && !gone) {
      const { upload: _upload, ...known } = c;
      return { ...known, revocation: { status: 'pending', checked_at: checkedAt, checked_by: who, last_status: status } };
    }
    // Not asked (no address, or the network): nothing is learned. Not there: counted, and called absent only
    // after it was found so more than once, and not while the publish that reserved it may still be running.
    const count = gone ? (Number(c.revocation?.gone_checks) || 0) + 1 : (Number(c.revocation?.gone_checks) || 0);
    const absent = gone && count >= ABSENT_CHECKS && !inFlight(c);
    return { ...c, revocation: { status: absent ? 'absent' : 'pending', checked_at: checkedAt, checked_by: who, last_status: status, gone_checks: count } };
  });
  await writeMetadata(models, episodeId, { ...metadata, [KEY]: entry });
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
    // The caption she published; a look published before captions were saved with it shows the entry's.
    caption: typeof look.site.caption === 'string' ? look.site.caption : (text(look.entry.caption) || ''),
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
    // Removing the entry would discard the record of copies still in the public bucket. While a look image is
    // on the website, or a copy's access is not yet known to be gone, the entry stays (take the look down
    // first). writeMetadata refuses it under the row's lock (PUBLIC_COPIES_PENDING).
    const next = { ...metadata };
    delete next[KEY];
    await writeMetadata(models, episodeId, next, { removing: metadata[KEY] });
  }
  return { sent: false };
}

module.exports = {
  DISCLOSURE, AMAZON_DISCLOSURE, CAPTION_MAX, isAmazonUrl, disclosureFor, captionDraft, postText, keepStyleSheet, parseMetadata,
  getStyleSheetDistribution, sendStyleSheetToDistribution, updateStyleSheetDistribution, removeStyleSheetFromDistribution,
  publishStyleSheetToSite, takeDownStyleSheetFromSite, setPublishedLinkAvailability, listPublicLooks, publicLook,
  httpsUrl, snapshotLinks, MATCHES, IMAGE_RIGHTS, CLEARED_RIGHTS, imageCleared,
  withdrawLookImageRights, checkPublicCopy, fetchStatus, writeMetadata, REV_KEY,
  // The look strip, drawn as the export (styleSheetService); here so a test can stand in for the drawing.
  drawLook: (models, episodeId) => require('./styleSheetService').exportStyleSheet(models, episodeId, 'look'),
};
