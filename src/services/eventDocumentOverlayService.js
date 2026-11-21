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
// The offer letter (Evoni, 2026-10-24), drawn as the Creator Partnership
// Agreement (Task #3206; the phone spec §13; utils/partnershipAgreement):
// the brand's letterhead in the event's colours, the title, Brand and
// Creator boxes, the letter's words, the deal as numbered clauses, then
// what happens next, the closing and two signature lines. The overlay is
// the document as it arrives in the episode (beat 5, after the invitation),
// so its stamp reads OFFER; the Event Package card shows EXECUTED once the
// event has started an episode.
const offerAmount = (n) => `${coins(n)} Prime Coins`;

/** Draws the agreement at height H; returns where its writing ends. */
function drawOfferLetter(ctx, H, { doc, event, terms = [] }) {
  const pa = require('../utils/partnershipAgreement');
  const OFFER = pa.agreementColours(event);
  const L = doc?.letter || {};
  const left = 80;
  const width = WIDTH - 160;
  ctx.fillStyle = OFFER.paper;
  ctx.fillRect(0, 0, WIDTH, H);
  ctx.fillStyle = OFFER.rule;
  ctx.fillRect(28, 28, WIDTH - 56, 14);
  ctx.strokeStyle = OFFER.rule; ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, WIDTH - 56, H - 56);

  // Letterhead: the brand, a rule, the agreement's title and the event.
  const org = pa.agreementBrand(event);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = OFFER.head;
  ctx.font = 'bold 54px CormorantGaramond';
  const [orgLine] = wrap(ctx, org.toUpperCase(), width - 230, 1);
  ctx.fillText(orgLine, left, 130);
  // The OFFER stamp, turned a little, top right.
  ctx.save();
  ctx.translate(WIDTH - left - 100, 104); ctx.rotate(-0.1);
  ctx.strokeStyle = OFFER.head; ctx.lineWidth = 4; ctx.strokeRect(-92, -34, 184, 60);
  ctx.fillStyle = OFFER.head; ctx.font = 'bold 34px LibreBaskerville';
  const stampW = ctx.measureText('OFFER').width;
  ctx.fillText('OFFER', -stampW / 2, 10);
  ctx.restore();
  ctx.strokeStyle = OFFER.rule; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(left, 156); ctx.lineTo(WIDTH - left, 156); ctx.stroke();
  ctx.fillStyle = OFFER.ink; ctx.font = 'bold 26px LibreBaskerville';
  const [title] = wrap(ctx, pa.agreementTitle(event), width, 1);
  ctx.fillText(title, left, 196);
  const byline = documentByline(event).replace(/^for [^·]*·?\s*/, '');
  if (byline) { ctx.fillStyle = OFFER.muted; ctx.font = 'normal 20px LibreBaskerville'; ctx.fillText(byline, left, 228); }

  // Brand and Creator boxes.
  const boxW = (width - 24) / 2;
  [['BRAND', org], ['CREATOR', 'Lala']].forEach(([label, name], i) => {
    const x = left + i * (boxW + 24);
    ctx.strokeStyle = OFFER.rule; ctx.lineWidth = 1.5; ctx.strokeRect(x, 252, boxW, 74);
    ctx.fillStyle = OFFER.muted; ctx.font = 'normal 15px LibreBaskerville'; ctx.fillText(label, x + 16, 278);
    ctx.fillStyle = OFFER.ink; ctx.font = 'bold 22px LibreBaskerville';
    ctx.fillText(wrap(ctx, name, boxW - 32, 1)[0] || '', x + 16, 310);
  });

  let y = 372;
  const para = (text, size = 25, lineH = 36, maxLines = 6) => {
    if (!text) return;
    ctx.fillStyle = OFFER.ink; ctx.font = `normal ${size}px LibreBaskerville`;
    const lines = wrap(ctx, text, width, maxLines);
    lines.forEach((line, n) => ctx.fillText(line, left, y + n * lineH));
    y += lineH * lines.length + 18;
  };
  para(L.greeting, 24, 34, 1);
  para(L.opening, 24, 34, 3);
  para(L.opportunity, 24, 34, 6);

  // THE TERMS: numbered clauses, 1 The engagement, then the deal's sections.
  const clauses = pa.agreementClauses(event, terms);
  ctx.fillStyle = OFFER.head; ctx.font = 'bold 22px LibreBaskerville';
  ctx.fillText('THE TERMS', left, y + 10);
  y += 46;
  let shown = 0;
  const total = clauses.reduce((n, sec) => n + sec.lines.length, 0);
  // The clauses stop where the room the closing and signatures need begins
  // (FOOT) on the tallest letter, and what is left out is counted, never
  // dropped without a word. Measured against the maximum height, not H:
  // the second pass is sized to fit what the first pass drew, so a short
  // letter must not lose a clause to its own fitted height.
  const FOOT = 360;
  const bottom = Math.max(H, MAX_HEIGHTS.offer_letter) - FOOT;
  for (const sec of clauses) {
    if (y + 32 + 30 > bottom) break;
    ctx.fillStyle = OFFER.head; ctx.font = 'bold 21px LibreBaskerville';
    ctx.fillText(`${sec.number}. ${sec.title}`, left, y);
    y += 32;
    for (const line of sec.lines) {
      if (y + 30 > bottom) break;
      ctx.fillStyle = OFFER.ink; ctx.font = 'normal 22px LibreBaskerville';
      const amount = line.amount != null ? offerAmount(line.amount) : '';
      const amountW = amount ? ctx.measureText(amount).width + 20 : 0;
      const wrapped = wrap(ctx, line.label, width - amountW - 32, sec.key === 'engagement' ? 3 : 1);
      wrapped.forEach((ln, n) => ctx.fillText(ln, left + 32, y + n * 30));
      if (amount) ctx.fillText(amount, WIDTH - left - ctx.measureText(amount).width, y);
      y += 30 * wrapped.length;
      if (line.detail) {
        ctx.fillStyle = OFFER.muted; ctx.font = 'normal 18px LibreBaskerville';
        const [d] = wrap(ctx, line.detail, width - 32, 1);
        ctx.fillText(d, left + 32, y);
        y += 28;
      }
      shown += 1;
    }
    y += 10;
  }
  if (shown < total) {
    ctx.fillStyle = OFFER.muted; ctx.font = 'italic 20px LibreBaskerville';
    ctx.fillText(`+ ${total - shown} more in the terms`, left + 32, y);
    y += 32;
  }
  y += 12;

  para(L.next_steps, 23, 33, 3);
  para(L.closing, 23, 33, 1);
  // Two signature lines: the brand's sender (in her hand's font), and the
  // Creator's, blank on the offer.
  const sigW = (width - 40) / 2;
  ctx.fillStyle = OFFER.head; ctx.font = '44px Caveat';
  ctx.fillText(wrap(ctx, L.sender_name || '', sigW, 1)[0] || '', left, y + 40);
  ctx.strokeStyle = OFFER.muted; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(left, y + 56); ctx.lineTo(left + sigW, y + 56); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left + sigW + 40, y + 56); ctx.lineTo(WIDTH - left, y + 56); ctx.stroke();
  y += 84;
  ctx.fillStyle = OFFER.muted; ctx.font = 'normal 18px LibreBaskerville';
  const brandSig = [L.sender_name, L.sender_title].filter(Boolean).join(' · ') || `For ${org}`;
  ctx.fillText(wrap(ctx, brandSig, sigW, 1)[0] || '', left, y);
  ctx.fillText('Lala · Creator', left + sigW + 40, y);
  return y + 40;
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

// ── The document presented for video (V1, Evoni 2026-11-19) ─────────────
// The same document, drawn by the same function from the same data, placed
// in a transparent 1920×1080 frame: one canonical document, and what is
// shown on video derived from it. Nothing here stores, names or places
// anything, and renderDocument above is unchanged.
//
//   floating  the whole page, scaled to fit: an object in the scene.
//   reading   the page large enough to read, as consecutive panels that
//             cover all of it, top to bottom.
//
// The frame and Prime's picture-in-picture window are the editor's own
// (utils/editTimeline). The paper and its shadow stay in the column to the
// left of that window, inside the frame's 5% safe area.
const { FRAME_W, FRAME_H, DEFAULT_LAYOUT } = require('../utils/editTimeline');

const PRESENTATIONS = Object.freeze(['floating', 'reading']);
/** Body text is readable on video from this size, in frame pixels at 1080p. */
const MIN_READABLE_PX = 28;
/** How far a panel repeats the one before it when no gap between lines can end it, in page pixels. */
const PANEL_OVERLAP = 80;
/** The space aimed for between a reading panel's cut edge and the nearest writing or mark, in frame pixels. */
const EDGE_PADDING_PX = 32;
/** A drawn rectangle up to this tall (page pixels) is a mark kept whole: a checkbox, a stamp, a name box. Taller ones are the page's own frame. */
const MARK_MAX_HEIGHT = 160;
const SAFE_X = Math.round(FRAME_W * 0.05);
const SAFE_Y = Math.round(FRAME_H * 0.05);
/** Prime's window, whole: it reaches past the safe area, so all of it is kept clear. */
const PRIME_WINDOW = Object.freeze({ x: DEFAULT_LAYOUT.x, y: DEFAULT_LAYOUT.y, w: DEFAULT_LAYOUT.w, h: DEFAULT_LAYOUT.h });
/** The gap kept between the column and Prime's window: the window's own margin from the frame's edge. */
const WINDOW_GAP = FRAME_W - (DEFAULT_LAYOUT.x + DEFAULT_LAYOUT.w);
/** Where a document may be: the safe area to the left of Prime's window. */
const COLUMN = Object.freeze({ x: SAFE_X, y: SAFE_Y, w: PRIME_WINDOW.x - WINDOW_GAP - SAFE_X, h: FRAME_H - 2 * SAFE_Y });
/** The room kept inside the column for the paper's shadow. */
const SHADOW = Object.freeze({ pad: 24, blur: 10, offsetY: 4, color: 'rgba(0, 0, 0, 0.3)' });
const PAPER_AREA = Object.freeze({ x: COLUMN.x + SHADOW.pad, y: COLUMN.y + SHADOW.pad, w: COLUMN.w - 2 * SHADOW.pad, h: COLUMN.h - 2 * SHADOW.pad });

/** A document that cannot be presented as asked. `code` says why; nothing is drawn clipped instead. */
class DocumentPresentationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DocumentPresentationError';
    this.code = code;
  }
}

/** The height renderDocument gave the page, read from its PNG (IHDR), so the two never disagree. */
function pngHeight(buffer) {
  return buffer.readUInt32BE(20);
}

/**
 * A drawing context that draws as `ctx` does and notes where each line of
 * text lands: { top, bottom } on the page and the font's size, weighted by
 * the line's width. The text itself is not kept. With `marks`, it also
 * notes the small rectangles drawn (a checkbox, a stamp's box, a name box:
 * MARK_MAX_HEIGHT or less), which a panel must not slice either.
 */
function recordingContext(ctx, lines, marks = null) {
  const transform = () => ctx.currentTransform || (ctx.getTransform ? ctx.getTransform() : { b: 0, d: 1, f: 0 });
  const noteRect = (x, y, w, h, grow) => {
    if (!marks) return;
    const t = transform();
    const xs = [x - grow, x + w + grow];
    const ys = [y - grow, y + h + grow];
    const mapped = [];
    for (const cx of xs) for (const cy of ys) mapped.push(t.b * cx + t.d * cy + t.f);
    const top = Math.min(...mapped);
    const bottom = Math.max(...mapped);
    if (bottom > top && bottom - top <= MARK_MAX_HEIGHT) marks.push({ top, bottom });
  };
  const note = (text, x, y) => {
    const m = ctx.measureText(String(text));
    if (!(m.width > 0)) return;
    const px = Number((/(\d+(?:\.\d+)?)px/.exec(ctx.font) || [])[1]) || 0;
    const t = transform();
    const xs = [x - (m.actualBoundingBoxLeft || 0), x + (m.actualBoundingBoxRight || m.width)];
    const ys = [y - (m.actualBoundingBoxAscent || px), y + (m.actualBoundingBoxDescent || 0)];
    const mapped = [];
    for (const cx of xs) for (const cy of ys) mapped.push(t.b * cx + t.d * cy + t.f);
    lines.push({ top: Math.min(...mapped), bottom: Math.max(...mapped), px, width: m.width });
  };
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'fillText' || prop === 'strokeText') {
        return (text, x, y, ...rest) => { note(text, x, y); return target[prop](text, x, y, ...rest); };
      }
      if (prop === 'strokeRect') {
        return (x, y, w, h) => { noteRect(x, y, w, h, (Number(target.lineWidth) || 1) / 2); return target.strokeRect(x, y, w, h); };
      }
      if (prop === 'fillRect') {
        return (x, y, w, h) => { noteRect(x, y, w, h, 0); return target.fillRect(x, y, w, h); };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

/**
 * The sizes the page's text is drawn at, from what was drawn: `body` is the
 * size that carries the most text (by width; the smaller size on a tie),
 * `min` the smallest.
 */
function textSizes(lines) {
  const byPx = new Map();
  for (const l of lines) if (l.px > 0) byPx.set(l.px, (byPx.get(l.px) || 0) + l.width);
  if (!byPx.size) return { body: 0, min: 0 };
  const body = [...byPx.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  return { body, min: Math.min(...byPx.keys()) };
}

/**
 * The page cut into panels of at most `capacity` page pixels, top to bottom:
 * [{ y0, y1, overlap }]. `lines` is everything a panel must show whole
 * (lines of text, and small marks). A panel ends in a gap between them:
 * one with `pad` clear page pixels on both sides when its lower half has
 * such a gap (the one nearest an even share of the page that is left),
 * otherwise the gap with the most room, which both panels then show in
 * full. Where the lower half has no gap at
 * all, the panel ends at its full height and the next starts PANEL_OVERLAP
 * higher (or at the top of what was cut, when that is higher still), so
 * everything is whole in at least one panel. Something no panel can hold,
 * or a cut that would make no progress, is an error, never a clipped line.
 */
function panelSlices(height, capacity, lines, { pad = 0 } = {}) {
  const tallest = lines.reduce((n, l) => Math.max(n, l.bottom - l.top), 0);
  if (tallest > capacity) {
    throw new DocumentPresentationError('TEXT_TALLER_THAN_PANEL', `A line of text is ${Math.ceil(tallest)} pixels tall and a panel holds ${Math.floor(capacity)}.`);
  }
  const cuts = (y) => lines.filter((l) => l.top < y && l.bottom > y);
  /** The room around a cut at y: to the nearest line above or below; -1 when it goes through one. */
  const room = (y) => {
    let least = Infinity;
    for (const l of lines) {
      if (l.top < y && l.bottom > y) return -1;
      const d = l.bottom <= y ? y - l.bottom : l.top - y;
      if (d < least) least = d;
    }
    return least;
  };
  const slices = [];
  let y0 = 0;
  let overlap = 0;
  while (y0 < height) {
    const limit = y0 + capacity;
    if (limit >= height) { slices.push({ y0, y1: height, overlap }); break; }
    const even = y0 + (height - y0) / Math.ceil((height - y0) / capacity);
    let padded = null; // the gap with `pad` clear on both sides, nearest the even share
    let widest = null; // else the gap with the most room
    let widestRoom = -1;
    for (let y = Math.floor(limit); y > y0 + capacity / 2; y -= 1) {
      const r = room(y);
      if (r < 0) continue;
      if (r >= pad && (padded == null || Math.abs(y - even) < Math.abs(padded - even))) padded = y;
      if (r > widestRoom || (r === widestRoom && Math.abs(y - even) < Math.abs(widest - even))) { widest = y; widestRoom = r; }
    }
    if (padded != null) {
      slices.push({ y0, y1: padded, overlap });
      y0 = padded;
      overlap = 0;
      continue;
    }
    if (widest != null) {
      // A gap narrower than the padding asks for: both panels show the
      // whole gap (this one to the line below it, the next from the line
      // above it), so each has all the room the page has there. Only
      // blank page is repeated.
      const above = Math.max(y0, ...lines.filter((l) => l.bottom <= widest).map((l) => l.bottom));
      const below = Math.min(limit, height, ...lines.filter((l) => l.top >= widest).map((l) => l.top));
      const next = Math.ceil(above);
      const y1 = Math.max(widest, Math.floor(below));
      if (next > y0) {
        slices.push({ y0, y1, overlap });
        overlap = y1 - next;
        y0 = next;
        continue;
      }
      slices.push({ y0, y1: widest, overlap });
      y0 = widest;
      overlap = 0;
      continue;
    }
    const cut = cuts(limit);
    const next = Math.floor(Math.min(limit - PANEL_OVERLAP, ...cut.map((l) => l.top)));
    if (next <= y0) {
      throw new DocumentPresentationError('NO_SAFE_PANEL_BOUNDARY', 'No panel boundary keeps every line of text whole.');
    }
    slices.push({ y0, y1: limit, overlap });
    overlap = limit - next;
    y0 = next;
  }
  return slices;
}

/**
 * Where the page's text and small marks land, from the drawing itself at
 * the page's own size: { height, lines: [{ top, bottom, px, width }],
 * marks: [{ top, bottom }] }, or null when drawing is unavailable.
 * Geometry only; the words are not kept.
 */
function measureDocumentText(type, data) {
  const draw = DRAW[type];
  const page = draw ? renderDocument(type, data) : null;
  if (!page) return null;
  const height = pngHeight(page);
  const lines = [];
  const marks = [];
  draw(recordingContext(createCanvas(WIDTH, height).getContext('2d'), lines, marks), height, data);
  return { height, lines, marks };
}

/** One frame: the page's rows y0..y1 at `scale`, its paper at `rect`, on a transparent frame. */
function drawFrame(draw, pageHeight, data, { scale, rect, y0 }) {
  const canvas = createCanvas(FRAME_W, FRAME_H);
  const ctx = canvas.getContext('2d');
  // The paper's shadow, from a filled rectangle the page then covers.
  ctx.save();
  ctx.shadowColor = SHADOW.color;
  ctx.shadowBlur = SHADOW.blur;
  ctx.shadowOffsetY = SHADOW.offsetY;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.translate(rect.x, rect.y - y0 * scale);
  ctx.scale(scale, scale);
  draw(ctx, pageHeight, data);
  ctx.restore();
  return canvas.toBuffer('image/png');
}

/**
 * The document presented for video, or null when drawing is unavailable
 * (as renderDocument). `data` is what renderDocument takes. Returns
 *   { type, presentation, frame, column, clear_of, page, scale, text,
 *     readable, panels: [{ index, of, source: { y0, y1 }, overlap, padding, rect, buffer }] }
 * where each buffer is a FRAME_W×FRAME_H PNG, transparent outside the
 * paper and its shadow; `text` is the body and smallest text sizes on the
 * page and on screen, and `past_page`, how many lines the page itself cuts
 * at its edge (they are shown as the page shows them); `readable` says the body text is MIN_READABLE_PX or
 * more on screen. It holds geometry and images only, never the document's
 * words. Throws DocumentPresentationError for a presentation that is not
 * one, or a document whose text cannot be kept whole.
 */
function presentDocument(type, data, { presentation = 'floating' } = {}) {
  if (!PRESENTATIONS.includes(presentation)) {
    throw new DocumentPresentationError('UNKNOWN_PRESENTATION', `"${presentation}" is not a presentation (${PRESENTATIONS.join(', ')}).`);
  }
  const draw = DRAW[type];
  const measured = measureDocumentText(type, data);
  if (!measured) return null;
  const { height: pageHeight } = measured;
  // A line the page itself cuts at its edge (renderDocument stops at the
  // type's maximum height) cannot be shown whole here either: this shows
  // the page as it is. It is counted and said (text.past_page), and the
  // panels are worked out from the part of it that is on the page.
  const pastPage = measured.lines.filter((l) => l.top < 0 || l.bottom > pageHeight).length;
  const onPage = (l) => ({ ...l, top: Math.max(0, l.top), bottom: Math.min(pageHeight, l.bottom) });
  const lines = measured.lines.map(onPage);
  // What a panel must show whole: the lines of text and the small marks.
  const whole = [...lines, ...measured.marks.map(onPage).filter((m) => m.bottom > m.top)];
  const sizes = textSizes(lines);

  let scale;
  let slices;
  if (presentation === 'floating') {
    const fit = Math.min(PAPER_AREA.w / WIDTH, PAPER_AREA.h / pageHeight);
    scale = Math.floor(WIDTH * fit) / WIDTH;
    slices = [{ y0: 0, y1: pageHeight, overlap: 0 }];
  } else {
    scale = PAPER_AREA.w / WIDTH;
    slices = panelSlices(pageHeight, PAPER_AREA.h / scale, whole, { pad: EDGE_PADDING_PX / scale });
  }
  const w = Math.round(WIDTH * scale);
  const panels = slices.map((slice, i) => {
    const h = Math.min(PAPER_AREA.h, Math.round((slice.y1 - slice.y0) * scale));
    const rect = {
      x: PAPER_AREA.x + Math.floor((PAPER_AREA.w - w) / 2),
      // A floating page sits in the middle of the column; a reading panel hangs from its top.
      y: presentation === 'floating' ? PAPER_AREA.y + Math.floor((PAPER_AREA.h - h) / 2) : PAPER_AREA.y,
      w,
      h,
    };
    // The room between each of the panel's edges and the nearest writing
    // or mark it shows, in frame pixels: at a cut edge EDGE_PADDING_PX is
    // aimed for, and what the page allows is what is said.
    const shown = whole.filter((l) => l.top >= slice.y0 && l.bottom <= slice.y1);
    const edge = (distance) => (shown.length ? Math.round(distance * scale) : null);
    const padding = {
      top: edge(Math.min(...shown.map((l) => l.top)) - slice.y0),
      bottom: edge(slice.y1 - Math.max(...shown.map((l) => l.bottom))),
    };
    return {
      index: i + 1,
      of: slices.length,
      source: { y0: slice.y0, y1: slice.y1 },
      overlap: slice.overlap,
      padding,
      rect,
      buffer: drawFrame(draw, pageHeight, data, { scale, rect, y0: slice.y0 }),
    };
  });
  const onScreen = (px) => Math.round(px * scale * 10) / 10;
  return {
    type,
    presentation,
    frame: { width: FRAME_W, height: FRAME_H },
    column: { ...COLUMN },
    clear_of: { ...PRIME_WINDOW },
    page: { width: WIDTH, height: pageHeight },
    scale,
    text: { body_px: sizes.body, min_px: sizes.min, body_px_on_screen: onScreen(sizes.body), min_px_on_screen: onScreen(sizes.min), past_page: pastPage },
    readable: sizes.body > 0 && sizes.body * scale >= MIN_READABLE_PX,
    panels,
  };
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

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/**
 * What the page is drawn from, as it stands now: the document, its event,
 * and for a shopping list the look and Lala's coins, for an offer letter
 * the deal's terms. { data, pieces } where `data` is what renderDocument
 * and presentDocument take. One reading of it for the canonical drawing
 * and for the presentations' check against it.
 */
async function documentDrawData(sequelize, { event, type, doc, terms = null }) {
  let balance = null;
  let look = null;
  if (type === 'shopping_list') {
    ({ look, balance } = await shoppingListContext(sequelize, event));
  }
  const pieces = look ? look.pieces : null;
  return { data: { doc, event, balance, pieces, terms: terms || [] }, pieces };
}

// ─── The presentations, stored (V2-2a-2, Evoni 2026-11-20) ──────────────────
//
// presentDocument draws the panels; this keeps them. A panel's file is
// named by its own bytes and written only where no file is: the same
// panel made twice is one file, and a file once written is never written
// over. Where the store cannot promise that, nothing is stored.

/** Raised when the panels' drawing changes: a set made under another revision is not this one. */
const PRESENTATION_REVISION = 1;
/** The namespace the sets' and panels' ids are derived in (any fixed uuid). */
const PRESENTATION_NAMESPACE = '6f1d1b0e-5a0e-4a53-9c0e-2f7d3f1a8b21';

class PresentationStorageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PresentationStorageError';
    this.code = code;
  }
}

/** The key in our bucket of one of our own file addresses, or null for anything else. */
function ownStorageKey(url) {
  const bucket = storageBucket();
  if (!bucket || typeof url !== 'string') return null;
  let parsed;
  try { parsed = new URL(url); } catch (err) { return null; }
  if (parsed.protocol !== 'https:' || !parsed.hostname.startsWith(`${bucket}.s3.`) || !parsed.hostname.endsWith('.amazonaws.com')) return null;
  return decodeURIComponent(parsed.pathname.slice(1)) || null;
}

function storageClient() {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
}

async function readOwnObject(key) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const got = await storageClient().send(new GetObjectCommand({ Bucket: storageBucket(), Key: key }));
  return Buffer.from(await got.Body.transformToByteArray());
}

/**
 * The bytes of a stored document image, read with the app's own
 * credentials (never by its open address): a file in our bucket, or the
 * data: address used where there is no bucket. Null when it is neither or
 * cannot be read.
 */
async function readStoredImage(url) {
  if (typeof url === 'string' && url.startsWith('data:image/png;base64,')) {
    return Buffer.from(url.slice('data:image/png;base64,'.length), 'base64');
  }
  const key = ownStorageKey(url);
  if (!key) return null;
  try {
    return await readOwnObject(key);
  } catch (err) {
    console.error('[DocumentPresentation] a stored image could not be read:', err.name || err.message);
    return null;
  }
}

/** Whether panels can be kept at all: only in a bucket (a 1920x1080 frame is not kept as a data: address). */
function presentationStorageAvailable() {
  return Boolean(storageBucket());
}

/**
 * Keep one panel. The key carries the panel's own hash. What is already
 * there is read first: these very bytes are reused, anything else is
 * PresentationStorageError('STORAGE_CONFLICT') and is not written over.
 * Where nothing is there the write is "only if nothing is there"
 * (If-None-Match: *), and what it left is read back. A store that does not
 * know the condition is refused ('STORAGE_NOT_IMMUTABLE'). Returns
 * { url, key, sha256, reused }.
 */
async function storePresentationPanel(buffer, { eventId, type, version, presentation, index, count }) {
  const bucket = storageBucket();
  if (!bucket) throw new PresentationStorageError('STORAGE_NOT_CONFIGURED', 'No storage is configured for presentation panels.');
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const region = process.env.AWS_REGION || 'us-east-1';
  const hash = sha256(buffer);
  const key = `overlays/event-documents/${eventId}/presentations/${type}-v${version}-${presentation}-${index}of${count}-${hash}.png`;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  const missing = (err) => {
    const status = err && err.$metadata ? err.$metadata.httpStatusCode : null;
    return status === 404 || err.name === 'NoSuchKey' || err.name === 'NotFound';
  };
  // What is there already is looked at first and never written over: the
  // very same panel is reused, anything else is a conflict.
  let stored = null;
  try {
    stored = await readOwnObject(key);
  } catch (err) {
    if (!missing(err)) throw new PresentationStorageError('STORAGE_UNREADABLE', `The storage could not be read to see whether this panel is kept (${err.name || 'error'}).`);
  }
  let reused = stored !== null;
  if (!stored) {
    try {
      await storageClient().send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buffer, ContentType: 'image/png', CacheControl: 'max-age=31536000, immutable', IfNoneMatch: '*',
      }));
    } catch (err) {
      const status = err && err.$metadata ? err.$metadata.httpStatusCode : null;
      const taken = status === 412 || err.name === 'PreconditionFailed';
      if (!taken) {
        // 501: the store does not know the condition, so it cannot promise
        // a file is written once. Anything else is simply not written.
        if (status === 501 || err.name === 'NotImplemented') throw new PresentationStorageError('STORAGE_NOT_IMMUTABLE', 'This storage cannot promise a file is written only once.');
        throw new PresentationStorageError('STORAGE_WRITE_FAILED', `A presentation panel could not be stored (${err.name || 'error'}).`);
      }
      // Another request wrote it between the look and the write.
      reused = true;
    }
    // Read back what is there now, written here or by that other request.
    try {
      stored = await readOwnObject(key);
    } catch (err) {
      throw new PresentationStorageError('STORAGE_UNREADABLE', `A stored presentation panel could not be read back (${err.name || 'error'}).`);
    }
  }
  if (sha256(stored) !== hash) {
    throw new PresentationStorageError('STORAGE_CONFLICT', 'A different file is already stored where this panel belongs. It was not replaced.');
  }
  return { url, key, sha256: hash, reused };
}

/**
 * A name-based uuid (version 5, RFC 4122: SHA-1 of the namespace's bytes
 * and the name): the same names always give the same id.
 */
function derivedId(...names) {
  const namespace = Buffer.from(PRESENTATION_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(namespace).update(names.join('|')).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Who a set of panels is: the event's document at a version, drawn from
 * the inputs `renderKey` stands for, in one presentation. And each of its
 * panels. The same set made again has the same ids.
 */
function presentationSetId({ eventId, type, version, renderKey, presentation }) {
  return derivedId('set', eventId, type, version, renderKey, presentation);
}
function presentationPanelId(setId, index, count) {
  return derivedId('panel', setId, index, count);
}

/**
 * The one string a set is made under: the document's version, the look's
 * total or the terms it was drawn with, the canonical page's own bytes and
 * the panels' revision. Any of them changing makes another set.
 */
function presentationRenderKey({ version, lookTotal = null, termsKey = null, canonicalSha256, revision = PRESENTATION_REVISION }) {
  return sha256(Buffer.from(JSON.stringify([version, lookTotal, termsKey, canonicalSha256, revision])));
}

/**
 * Both presentations of a page, drawn (not stored). For each:
 *   { presentation, ok: true, readable, body_px_on_screen, past_page, panels: [{ index, count, buffer, sha256, rect, source }] }
 * or { presentation, ok: false, code, message } when it cannot be shown
 * whole or, for reading, not at a size to read (READING_NOT_READABLE: a
 * reading set that cannot be read is not kept). A floating page too small
 * to read is kept, with readable: false. Null when drawing is unavailable.
 * `present` is presentDocument (a test may stand in for it).
 */
function drawPresentations(type, data, present = presentDocument) {
  const out = [];
  for (const presentation of PRESENTATIONS) {
    let drawn;
    try {
      drawn = present(type, data, { presentation });
    } catch (err) {
      if (!(err instanceof DocumentPresentationError)) throw err;
      out.push({ presentation, ok: false, code: err.code, message: err.message });
      continue;
    }
    if (!drawn) return null;
    if (presentation === 'reading' && !drawn.readable) {
      out.push({ presentation, ok: false, code: 'READING_NOT_READABLE', message: `The reading panels' text would be ${drawn.text.body_px_on_screen} px on screen; ${MIN_READABLE_PX} px is the least that reads.` });
      continue;
    }
    out.push({
      presentation,
      ok: true,
      readable: drawn.readable,
      body_px_on_screen: drawn.text.body_px_on_screen,
      past_page: drawn.text.past_page,
      panels: drawn.panels.map((panel) => ({
        index: panel.index, count: panel.of, buffer: panel.buffer, sha256: sha256(panel.buffer), rect: panel.rect, source: panel.source,
      })),
    });
  }
  return out;
}

/**
 * Draw an approved document as its overlay and record it on the document.
 * Returns the overlay { asset_id, url, version, made_at }, or null when it
 * could not be drawn (the approval stands either way).
 */
async function makeDocumentOverlay(models, { event, type, doc, terms = null }) {
  const { sequelize } = models;
  if (!doc || doc.status !== 'approved') return null;
  const { data, pieces } = await documentDrawData(sequelize, { event, type, doc, terms });
  const buffer = renderDocument(type, data);
  if (!buffer) return null;
  const url = await storePng(buffer, event.id, type);
  const assetId = crypto.randomUUID();
  const madeAt = new Date().toISOString();
  // What was drawn, by its bytes: the presentations are made only beside
  // the very image they match (V2-2a-2).
  const contentSha256 = sha256(buffer);
  const metadata = { source: 'event_document', event_id: event.id, document_type: type, document_version: doc.version, content_sha256: contentSha256 };
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
  const drawn = { asset_id: assetId, url, version: doc.version, made_at: madeAt, content_sha256: contentSha256 };
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
  presentDocument,
  measureDocumentText,
  panelSlices,
  DocumentPresentationError,
  PRESENTATIONS,
  MIN_READABLE_PX,
  PANEL_OVERLAP,
  EDGE_PADDING_PX,
  shoppingLines,
  shoppingListContext,
  documentByline,
  makeDocumentOverlay,
  overlayState,
  sha256,
  documentDrawData,
  PRESENTATION_REVISION,
  PresentationStorageError,
  readStoredImage,
  presentationStorageAvailable,
  storePresentationPanel,
  presentationSetId,
  presentationPanelId,
  presentationRenderKey,
  drawPresentations,
  LABELS,
};
