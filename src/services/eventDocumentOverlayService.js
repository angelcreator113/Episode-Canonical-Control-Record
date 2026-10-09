'use strict';

/**
 * The event's in-world documents as overlays (Evoni, 2026-10-07: "i want
 * both the shopping list and career list and invitations as overlays";
 * "none of the overlays should be beats for now").
 *
 * When a shopping list or a career plan is approved, it is drawn as an image
 * the way the Event Package shows it (EventDocuments' ShoppingPaper and
 * CareerCard): the shopping list on lined pink paper in Lala's handwriting,
 * with each line's piece owned or its coins and the total against her
 * balance; the career plan on a lavender card, This event, Bigger goals and
 * what the deal expects of her. Drawn with Canvas (the invitation's
 * approach: fonts from src/assets/fonts), no image model and no cost.
 *
 * The image is an assets row (asset_type DOCUMENT_OVERLAY, so the show's
 * Overlays library, which reads UI_OVERLAY, does not list it) with the
 * event's show_id and, once Start Episode has run, its episode_id; the
 * document records it as overlay { asset_id, url, version, made_at }. A
 * document edited or redrafted after it is outdated (overlay.version is not
 * the document's). Nothing is placed on a beat.
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
// Portrait, as tall as the document needs: MIN_HEIGHT to MAX_HEIGHT.
const MIN_HEIGHT = 760;
const MAX_HEIGHT = 1200;
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
 */
function shoppingLines(doc, outfitPieces = []) {
  const { listSlotOf } = require('./todoListService');
  const pieces = Array.isArray(outfitPieces) ? outfitPieces.filter(Boolean) : [];
  const used = new Set();
  const line = (base, piece) => ({ ...base, piece, owned: piece ? pieceHad(piece) : false, cost: piece ? pieceCost(piece) : 0 });
  const lines = (doc?.items || []).map((item) => {
    const index = pieces.findIndex((p, i) => !used.has(i) && listSlotOf(p.category || p.clothing_category) === item.slot);
    if (index >= 0) used.add(index);
    return line({ slot: item.slot, label: item.label }, index >= 0 ? pieces[index] : null);
  });
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
function drawShoppingList(ctx, H, { doc, event, balance, pieces }) {
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

  const { lines, total } = shoppingLines(doc, pieces || event?.outfit_pieces);
  let y = 182 + ROW;
  for (const l of lines.slice(0, 16)) {
    ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 3;
    ctx.strokeRect(110, y - 30, 30, 30);
    if (l.owned) { ctx.font = 'bold 34px Caveat'; ctx.fillStyle = COLORS.ink; ctx.fillText('✓', 113, y - 4); }
    ctx.font = '40px Caveat';
    ctx.fillStyle = COLORS.pinkInk;
    const cost = l.piece ? (l.owned ? ' · owned' : ` · ${coins(l.cost)} coins`) : '';
    const [first] = wrap(ctx, `${l.label}${cost}`, WIDTH - 180, 1);
    ctx.fillText(first, 160, y);
    if (l.owned) {
      const w = ctx.measureText(l.label).width;
      ctx.strokeStyle = COLORS.pinkInk; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(160, y - 12); ctx.lineTo(160 + Math.min(w, WIDTH - 180), y - 12); ctx.stroke();
    }
    y += ROW;
  }
  ctx.font = 'bold 46px Caveat';
  ctx.fillText(`Total ${coins(total)} coins${balance != null ? ` / ${coins(balance)}` : ''}`, 110, y + 6);
  ctx.font = '34px Caveat';
  ctx.fillText('comfy enough to stand all night!!', 110, y + ROW + 6);
  return y + ROW + 6;
}

/** Draws the plan at height H; returns where its writing ends. */
function drawCareerPlan(ctx, H, { doc, deliverables = [] }) {
  ctx.fillStyle = COLORS.lavenderSoft;
  ctx.fillRect(0, 0, WIDTH, H);
  ctx.strokeStyle = COLORS.lavenderLine; ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, WIDTH - 48, H - 48);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.lavenderText;
  ctx.font = 'bold 64px CormorantGaramond';
  ctx.fillText('Career Plan', 80, 140);
  ctx.strokeStyle = COLORS.lavenderLine; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, 170); ctx.lineTo(WIDTH - 80, 170); ctx.stroke();

  const items = doc?.items || [];
  const sections = [
    ['EXPECTED OF HER', deliverables.map((d) => ({ label: d.label, note: d.required ? 'required' : 'optional' })), null],
    ['THIS EVENT', items.filter((i) => (i.section || 'this_event') === 'this_event'), 'No goals for this event'],
    ['BIGGER GOALS', items.filter((i) => i.section === 'bigger_goals'), 'No active career goals yet'],
  ];
  let y = 230;
  for (const [title, rows, empty] of sections) {
    if (!rows.length && empty === null) continue;
    ctx.fillStyle = COLORS.pinkInk;
    ctx.font = 'normal 24px LibreBaskerville';
    ctx.fillText(title, 80, y);
    y += 50;
    if (!rows.length) {
      ctx.fillStyle = COLORS.muted; ctx.font = 'normal 28px LibreBaskerville';
      ctx.fillText(empty, 80, y); y += 70;
      continue;
    }
    for (const r of rows.slice(0, 6)) {
      if (y > H - 160) break;
      ctx.strokeStyle = COLORS.lavenderText; ctx.lineWidth = 3;
      ctx.strokeRect(80, y - 26, 28, 28);
      ctx.fillStyle = COLORS.ink; ctx.font = 'normal 28px LibreBaskerville';
      const text = r.note ? `${r.label} (${r.note})` : r.label;
      const lines = wrap(ctx, text, WIDTH - 220, 2);
      lines.forEach((line, n) => ctx.fillText(line, 128, y + n * 38));
      y += 38 * lines.length + 22;
    }
    y += 30;
  }
  ctx.fillStyle = COLORS.pinkInk;
  ctx.font = '40px Caveat';
  const sign = 'one step at a time, L.';
  ctx.fillText(sign, WIDTH - 80 - ctx.measureText(sign).width, H - 80);
  return y + 60; // the sign sits below the writing
}

const DRAW = { shopping_list: drawShoppingList, career_plan: drawCareerPlan };

/**
 * The document as a PNG buffer, or null when drawing is unavailable. Drawn
 * once to measure its writing, then at the height that fits it.
 */
function renderDocument(type, data) {
  const draw = DRAW[type];
  if (!draw || !drawingAvailable()) return null;
  const end = draw(createCanvas(WIDTH, MAX_HEIGHT).getContext('2d'), MAX_HEIGHT, data);
  const height = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, end + 120)));
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

const LABELS = { shopping_list: 'Shopping list', career_plan: 'Career plan' };

/**
 * Draw an approved document as its overlay and record it on the document.
 * Returns the overlay { asset_id, url, version, made_at }, or null when it
 * could not be drawn (the approval stands either way).
 */
async function makeDocumentOverlay(models, { event, type, doc, deliverables = [] }) {
  const { sequelize } = models;
  if (!doc || doc.status !== 'approved') return null;
  let balance = null;
  let look = null;
  if (type === 'shopping_list') {
    ({ look, balance } = await shoppingListContext(sequelize, event));
  }
  const pieces = look ? look.pieces : null;
  const buffer = renderDocument(type, { doc, event, balance, deliverables, pieces });
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
function overlayState(doc, lookTotal = null) {
  if (!doc?.overlay?.url) return 'not_made';
  if (doc.status !== 'approved' || doc.overlay.version !== doc.version) return 'outdated';
  if (lookTotal != null && doc.overlay.look_total != null && Number(doc.overlay.look_total) !== Number(lookTotal)) return 'outdated';
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
