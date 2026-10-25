'use strict';

/**
 * The event's in-world documents as overlays (Evoni, 2026-10-07: "i want
 * both the shopping list and career list and invitations as overlays";
 * "none of the overlays should be beats for now").
 *
 * When a shopping list or an offer letter is approved, it is drawn as an image
 * the way the Event Package shows it (EventDocuments' ShoppingPaper and
 * OfferLetter): the shopping list on lined pink paper in Lala's handwriting,
 * a to-do list (no line ticked for an owned piece, no balance; Evoni,
 * 2026-10-11), each piece still to buy with its coins and the total; the
 * offer letter (2026-10-24) on cream letterhead from the brand or host,
 * with THE TERMS from the deal. Drawn with Canvas (the invitation's
 * approach: fonts from src/assets/fonts), no image model and no cost.
 *
 * The image is an assets row (asset_type DOCUMENT_OVERLAY, so the show's
 * Overlays library, which reads UI_OVERLAY, does not list it) with the
 * event's show_id and, once Start Episode has run, its episode_id; the
 * document records it as overlay { asset_id, url, version, made_at }. A
 * document edited or redrafted after it is outdated (overlay.version is not
 * the document's). Only the offer letter is assigned a beat (6, after the
 * invitation; eventDocumentsService.syncOfferLetterPlacement).
 *
 * canvas is an optional native dependency; without it nothing is drawn and
 * the approval stands.
 */

const crypto = require('crypto');
const path = require('path');

let createCanvas;
let registerFont;
try {
  ({ createCanvas, registerFont } = require('canvas'));
} catch (err) {
  console.warn('[DocumentOverlay] canvas not available — document overlays are not drawn:', err.message);
}

const WIDTH = 900;
// Portrait, as tall as the document needs: MIN_HEIGHT to its MAX_HEIGHT
// (an offer letter, with its terms, runs longer than a list).
const MIN_HEIGHT = 760;
const MAX_HEIGHT = 1200;
const MAX_HEIGHTS = Object.freeze({ offer_letter: 1700 });
const COLORS = Object.freeze({
  pinkPaper: '#FBEFF3', // --accent-subtle
  pinkLine: '#E8A0B4', // --accent-light
  pinkInk: '#9E4E68', // --accent-dark
  ruled: '#E8E0D0', // --lala-parchment-3
  tape: '#C9B8E8', // --lala-lavender-light
  ink: '#2C2C2C', // --lala-ink
  lavenderSoft: '#ECE6F7', // --lala-lavender-soft
  lavenderLine: '#D9CFEE', // --lala-lavender-line
  lavenderText: '#4A3B7A', // --lala-lavender-text
  muted: '#6B6B6B',
});

let fontsReady = null;
/** Caveat (her hand) and the invitation's Cormorant; true when both registered. */
function ensureFonts() {
  if (fontsReady !== null) return fontsReady;
  fontsReady = false;
  if (!registerFont) return fontsReady;
  try {
    const docs = path.join(__dirname, '../assets/fonts/documents');
    const inv = path.join(__dirname, '../assets/fonts/invitation');
    registerFont(path.join(docs, 'Caveat-Regular.ttf'), { family: 'Caveat', weight: 'normal' });
    registerFont(path.join(docs, 'Caveat-SemiBold.ttf'), { family: 'Caveat', weight: 'bold' });
    registerFont(path.join(inv, 'CormorantGaramond-Bold.ttf'), { family: 'CormorantGaramond', weight: 'bold' });
    registerFont(path.join(inv, 'LibreBaskerville-Regular.ttf'), { family: 'LibreBaskerville', weight: 'normal' });
    fontsReady = true;
  } catch (err) {
    console.error('[DocumentOverlay] font registration failed:', err.message);
  }
  return fontsReady;
}

function drawingAvailable() {
  return Boolean(createCanvas) && ensureFonts();
}

const coins = (n) => Number(n || 0).toLocaleString('en-US');

/** "for Studio by Sable · Nov 12" (lib/eventDocuments.documentByline). */
function documentByline(event) {
  const who = event?.host_brand || event?.host || event?.name || '';
  let when = '';
  if (event?.event_date) {
    const d = new Date(event.event_date);
    if (!Number.isNaN(d.getTime())) when = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return [who && `for ${who}`, when].filter(Boolean).join(' · ');
}

// What a piece costs on the list, and whether Lala has it. A piece from the
// episode's look (episodeLookCharges.episodeLook) carries the charge Finalize
// books for it, so the list adds up what the Money page and Finalize do: a
// piece owned or already bought, gifted or borrowed costs nothing; a rented
// one its rental (Evoni, 2026-10-09: "Lala's shopping list overlay is not
// showing the correct total for everything"). A piece without one (the
// event's outfit before Start Episode) costs its coin_cost unless owned.
function pieceCost(piece) {
  if (piece && 'charge' in piece) return piece.charge ? Number(piece.charge.amount) || 0 : 0;
  return piece && piece.is_owned !== true ? Number(piece.coin_cost) || 0 : 0;
}
function pieceHad(piece) {
  if (piece && 'charge' in piece) return !piece.charge && piece.free_because !== 'free';
  return piece?.is_owned === true;
}

/**
 * The shopping list's lines with the look's pieces (lib/eventDocuments.
 * shoppingLines). Each item takes the first piece for its line; a piece no
 * item takes is a line of its own, so the total is every piece the look
 * costs, not only the ones the list names.
 *
 * The main outfit line (slot dress) is a dress, or a top and a bottom
 * (listSlotsFilled; Task #3205): with no dress it takes the look's top and
 * bottom, or is covered when its own top and bottom lines hold them. A
 * line's slot is read like a piece's category, so the AI's "heels" or
 * "clutch" still names the shoes or purse line.
 */
function shoppingLines(doc, outfitPieces = []) {
  const { listSlotOf } = require('./todoListService');
  const pieces = Array.isArray(outfitPieces) ? outfitPieces.filter(Boolean) : [];
  const used = new Set();
  const lineOf = (p) => listSlotOf(p.category || p.clothing_category);
  const take = (slot) => {
    const index = pieces.findIndex((p, i) => !used.has(i) && lineOf(p) === slot);
    if (index >= 0) used.add(index);
    return index >= 0 ? pieces[index] : null;
  };
  const line = (base, piece) => ({ ...base, piece, owned: piece ? pieceHad(piece) : false, cost: piece ? pieceCost(piece) : 0, filled: Boolean(piece) });
  const items = doc?.items || [];
  const slots = items.map((item) => (item.slot == null || item.slot === '' ? null : listSlotOf(String(item.slot)) || String(item.slot).toLowerCase().trim()));
  const lines = items.map((item, n) => line({ slot: item.slot, label: item.label }, take(slots[n])));
  const main = lines.findIndex((l, n) => slots[n] === 'dress' && !l.piece);
  if (main >= 0) {
    const onOwnLine = (slot) => lines.some((l, n) => slots[n] === slot && l.piece);
    const free = (slot) => pieces.some((p, i) => !used.has(i) && lineOf(p) === slot);
    const halves = ['top', 'bottom'];
    if (halves.every((s) => onOwnLine(s) || free(s))) {
      const taken = halves.filter((s) => !onOwnLine(s)).map(take);
      lines[main] = taken.length
        ? { ...lines[main], piece: taken[0], pieces: taken, filled: true, owned: taken.every(pieceHad), cost: taken.reduce((n, p) => n + pieceCost(p), 0) }
        : { ...lines[main], filled: true, covered: true };
    }
  }
  pieces.forEach((p, i) => {
    if (!used.has(i)) lines.push(line({ slot: 'extra', label: p.name || 'Another piece', extra: true }, p));
  });
  return { lines, total: lines.reduce((n, l) => n + l.cost, 0) };
}

/** Words wrapped to a width; at most maxLines, the last one ending "…" when cut. */
function wrap(ctx, text, width, maxLines = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, '')}…`;
    return kept;
  }
  return lines;
}

/** Draws the list at height H; returns where its writing ends. */
function drawShoppingList(ctx, H, { doc, event, pieces }) {
  const ROW = 56;
  ctx.fillStyle = COLORS.pinkPaper;
  ctx.fillRect(0, 0, WIDTH, H);
  ctx.strokeStyle = COLORS.ruled;
  ctx.lineWidth = 2;
  for (let y = 140; y < H; y += ROW) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
  ctx.strokeStyle = COLORS.pinkLine;
  ctx.beginPath(); ctx.moveTo(84, 0); ctx.lineTo(84, H); ctx.stroke();
  ctx.fillStyle = COLORS.tape;
  ctx.save(); ctx.translate(WIDTH / 2, 18); ctx.rotate(-0.03); ctx.fillRect(-110, -18, 220, 36); ctx.restore();

  ctx.fillStyle = COLORS.pinkInk;
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 64px Caveat';
  ctx.fillText("Lala's shopping list", 110, 118);
  ctx.font = '34px Caveat';
  ctx.fillText(documentByline(event), 110, 182);

  // A to-do list (Evoni, 2026-10-11): she crosses lines off in the show, so
  // no line is ticked or struck because a piece is owned, and no balance; a
  // piece still to buy keeps its coins. The note is the list's own, if any.
  const { lines, total } = shoppingLines(doc, pieces || event?.outfit_pieces);
  let y = 182 + ROW;
  // At most SHOPPING_ROWS lines; the rest are counted on a last line, never
  // dropped without a word (2026-10-24).
  const shown = lines.length > SHOPPING_ROWS ? lines.slice(0, SHOPPING_ROWS - 1) : lines;
  for (const l of shown) {
    ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 3;
    ctx.strokeRect(110, y - 30, 30, 30);
    ctx.font = '40px Caveat';
    ctx.fillStyle = COLORS.pinkInk;
    const cost = l.piece && !l.owned && l.cost > 0 ? ` · ${coins(l.cost)} coins` : '';
    const [first] = wrap(ctx, `${l.label}${cost}`, WIDTH - 180, 1);
    ctx.fillText(first, 160, y);
    y += ROW;
  }
  if (shown.length < lines.length) {
    ctx.font = '36px Caveat';
    ctx.fillStyle = COLORS.pinkInk;
    ctx.fillText(`+ ${lines.length - shown.length} more on her list`, 160, y);
    y += ROW;
  }
  ctx.font = 'bold 46px Caveat';
  ctx.fillText(`Total ${coins(total)} coins`, 110, y + 6);
  const note = typeof doc?.note === 'string' ? doc.note.trim() : '';
  if (!note) return y + 6;
  ctx.font = '34px Caveat';
  ctx.fillText(note, 110, y + ROW + 6);
  return y + ROW + 6;
}

/** Draws the plan at height H; returns where its writing ends. */
// The offer letter (Evoni, 2026-10-24): a formal letter on cream
// letterhead from the brand or host, then THE TERMS from the deal, then
// what happens next, the closing and a signature.
const OFFER = Object.freeze({
  paper: '#FAF7F0', // --lala-parchment
  rule: '#B8962E', // --lala-gold
  ink: '#2C2C2C', // --lala-ink
  muted: '#6B6B6B',
  head: '#4A3B7A', // --lala-lavender-text
});
const offerAmount = (n) => `${coins(n)} Prime Coins`;

/** Draws the letter at height H; returns where its writing ends. */
function drawOfferLetter(ctx, H, { doc, event, terms = [] }) {
  const L = doc?.letter || {};
  const left = 80;
  const width = WIDTH - 160;
  ctx.fillStyle = OFFER.paper;
  ctx.fillRect(0, 0, WIDTH, H);
  ctx.strokeStyle = OFFER.rule; ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, WIDTH - 56, H - 56);

  // Letterhead: who it is from, a rule, the date and the event.
  const org = (event?.host_brand || event?.host || 'The Host').trim();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = OFFER.head;
  ctx.font = 'bold 54px CormorantGaramond';
  ctx.fillText(org.toUpperCase(), left, 122);
  ctx.strokeStyle = OFFER.rule; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(left, 146); ctx.lineTo(WIDTH - left, 146); ctx.stroke();
  ctx.fillStyle = OFFER.muted;
  ctx.font = 'normal 22px LibreBaskerville';
  ctx.fillText(`Offer of partnership · ${documentByline(event).replace(/^for [^·]*·?\s*/, '') || (event?.name || '')}`.trim(), left, 182);

  let y = 240;
  const para = (text, size = 25, lineH = 36, maxLines = 6) => {
    if (!text) return;
    ctx.fillStyle = OFFER.ink; ctx.font = `normal ${size}px LibreBaskerville`;
    const lines = wrap(ctx, text, width, maxLines);
    lines.forEach((line, n) => ctx.fillText(line, left, y + n * lineH));
    y += lineH * lines.length + 18;
  };
  para(L.greeting, 25, 36, 1);
  para(L.opening, 25, 36, 3);
  para(L.opportunity, 25, 36, 7);

  // THE TERMS, from the deal.
  if (terms.length) {
    ctx.fillStyle = OFFER.head; ctx.font = 'bold 22px LibreBaskerville';
    ctx.fillText('THE TERMS', left, y + 10);
    y += 46;
    let shown = 0;
    const total = terms.reduce((n, sec) => n + sec.lines.length, 0);
    // The terms stop where the room the closing and signature need begins
    // (FOOT), and what is left out is counted, never dropped without a word.
    const FOOT = 330;
    for (const sec of terms) {
      if (y + 32 + 30 > H - FOOT) break;
      ctx.fillStyle = OFFER.muted; ctx.font = 'italic 21px LibreBaskerville';
      ctx.fillText(sec.title, left, y);
      y += 32;
      for (const line of sec.lines) {
        if (y + 30 > H - FOOT) break;
        ctx.fillStyle = OFFER.ink; ctx.font = 'normal 23px LibreBaskerville';
        const amount = line.amount != null ? offerAmount(line.amount) : '';
        const amountW = amount ? ctx.measureText(amount).width + 20 : 0;
        const [first] = wrap(ctx, line.label, width - amountW - 24, 1);
        ctx.fillText(`· ${first}`, left + 8, y);
        if (amount) ctx.fillText(amount, WIDTH - left - ctx.measureText(amount).width, y);
        y += 30;
        if (line.detail) {
          ctx.fillStyle = OFFER.muted; ctx.font = 'normal 18px LibreBaskerville';
          const [d] = wrap(ctx, line.detail, width - 24, 1);
          ctx.fillText(d, left + 28, y);
          y += 28;
        }
        shown += 1;
      }
      y += 10;
    }
    if (shown < total) {
      ctx.fillStyle = OFFER.muted; ctx.font = 'italic 20px LibreBaskerville';
      ctx.fillText(`+ ${total - shown} more in the terms`, left + 8, y);
      y += 32;
    }
    y += 12;
  }

  para(L.next_steps, 24, 34, 3);
  para(L.closing, 24, 34, 1);
  // The signature in her hand's font; the name and title under it.
  ctx.fillStyle = OFFER.head; ctx.font = '46px Caveat';
  ctx.fillText(L.sender_name || '', left, y + 34);
  y += 60;
  ctx.fillStyle = OFFER.muted; ctx.font = 'normal 20px LibreBaskerville';
  if (L.sender_name) { ctx.fillText(L.sender_name, left, y); y += 28; }
  if (L.sender_title) { ctx.fillText(L.sender_title, left, y); y += 28; }
  return y + 20;
}

const SHOPPING_ROWS = 16;
const DRAW = { shopping_list: drawShoppingList, offer_letter: drawOfferLetter };

/**
 * The document as a PNG buffer, or null when drawing is unavailable. Drawn
 * once to measure its writing, then at the height that fits it.
 */
function renderDocument(type, data) {
  const draw = DRAW[type];
  if (!draw || !drawingAvailable()) return null;
  const max = MAX_HEIGHTS[type] || MAX_HEIGHT;
  const end = draw(createCanvas(WIDTH, max).getContext('2d'), max, data);
  const height = Math.round(Math.min(max, Math.max(MIN_HEIGHT, end + 120)));
  const canvas = createCanvas(WIDTH, height);
  draw(canvas.getContext('2d'), height, data);
  return canvas.toBuffer('image/png');
}

function storageBucket() {
  return process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || null;
}

/** Stores the PNG: S3 when a bucket is configured, else a data URL (as the title overlay does). */
async function storePng(buffer, eventId, type) {
  const bucket = storageBucket();
  if (!bucket) return `data:image/png;base64,${buffer.toString('base64')}`;
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const region = process.env.AWS_REGION || 'us-east-1';
  const key = `overlays/event-documents/${eventId}/${type}-${crypto.randomUUID()}.png`;
  await new S3Client({ region }).send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: buffer, ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

const LABELS = { shopping_list: 'Shopping list', offer_letter: 'Offer letter' };

/**
 * Draw an approved document as its overlay and record it on the document.
 * Returns the overlay { asset_id, url, version, made_at }, or null when it
 * could not be drawn (the approval stands either way).
 */
async function makeDocumentOverlay(models, { event, type, doc, terms = null }) {
  const { sequelize } = models;
  if (!doc || doc.status !== 'approved') return null;
  let balance = null;
  let look = null;
  if (type === 'shopping_list') {
    ({ look, balance } = await shoppingListContext(sequelize, event));
  }
  const pieces = look ? look.pieces : null;
  const buffer = renderDocument(type, { doc, event, balance, pieces, terms: terms || [] });
  if (!buffer) return null;
  const url = await storePng(buffer, event.id, type);
  const assetId = crypto.randomUUID();
  const madeAt = new Date().toISOString();
  const metadata = { source: 'event_document', event_id: event.id, document_type: type, document_version: doc.version };
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, approval_status, metadata, created_at, updated_at)
       VALUES (:id, :name, 'DOCUMENT_OVERLAY', :role, 'EPISODE', 'EPISODE', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, 'approved', CAST(:metadata AS jsonb), NOW(), NOW())`,
      { replacements: {
        id: assetId, name: `${LABELS[type]}: ${event.name || 'event'}`, role: `UI.OVERLAY.${type.toUpperCase()}`, url,
        showId: event.show_id, episodeId: event.used_in_episode_id || null, metadata: JSON.stringify(metadata),
      }, transaction });
    // One current overlay per document: the earlier ones are soft-deleted.
    await sequelize.query(
      `UPDATE assets SET deleted_at = NOW(), updated_at = NOW()
        WHERE asset_type = 'DOCUMENT_OVERLAY' AND deleted_at IS NULL AND id <> :assetId
          AND metadata->>'event_id' = :eventId AND metadata->>'document_type' = :type`,
      { replacements: { assetId, eventId: event.id, type }, transaction });
  });
  const drawn = { asset_id: assetId, url, version: doc.version, made_at: madeAt };
  // The total it was drawn with: a look that changes after approval leaves
  // the image out of date (overlayState), and Approve draws it again.
  if (type === 'shopping_list') drawn.look_total = shoppingLines(doc, pieces || event?.outfit_pieces).total;
  // The terms it was drawn with: a deal changed after approval leaves the
  // image out of date (overlayState), and Approve draws it again.
  if (type === 'offer_letter') drawn.terms_key = require('./offerLetterService').termsKey(terms || []);
  return drawn;
}

/**
 * The look the shopping list reads, and Lala's balance: the episode's look
 * as Finalize charges it (episodeLookCharges.episodeLook; the episode the
 * event started, else the event's own outfit), and her current coins. Each
 * read that fails leaves its part null, logged.
 */
async function shoppingListContext(sequelize, event) {
  let look = null;
  let balance = null;
  try {
    const { episodeLook } = require('./episodeLookCharges');
    look = await episodeLook(sequelize, { episodeId: event.used_in_episode_id || null, event, showId: event.show_id });
  } catch (err) {
    console.error('[DocumentOverlay] look read failed (the list reads the event outfit):', err.message);
  }
  try {
    const { getCurrentBalance } = require('./financialTransactionService');
    balance = await getCurrentBalance(sequelize, event.show_id);
  } catch (err) {
    console.error('[DocumentOverlay] balance read failed (the total shows without it):', err.message);
  }
  return { look, balance };
}

/**
 * An overlay is current when it was drawn from the document as it stands
 * (approved, same version) and, for a shopping list given the look's total
 * now, with that total.
 */
function overlayState(doc, lookTotal = null, termsKey = null) {
  if (!doc?.overlay?.url) return 'not_made';
  if (doc.status !== 'approved' || doc.overlay.version !== doc.version) return 'outdated';
  if (lookTotal != null && doc.overlay.look_total != null && Number(doc.overlay.look_total) !== Number(lookTotal)) return 'outdated';
  if (termsKey != null && doc.overlay.terms_key != null && doc.overlay.terms_key !== termsKey) return 'outdated';
  return 'current';
}

module.exports = {
  drawingAvailable,
  renderDocument,
  shoppingLines,
  shoppingListContext,
  documentByline,
  makeDocumentOverlay,
  overlayState,
};
