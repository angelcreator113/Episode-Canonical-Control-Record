'use strict';

/**
 * Amazon order history onto wardrobe pieces (Task #3102; Evoni, 2026-10-13:
 * "Amazon CSV first, with manual entry kept. Preview, confirm, detect
 * duplicates and match to pieces. Defer Gmail. Never deduct Lala's coins.";
 * a confirmed line fills empty real-world fields only; a line that matches
 * no piece is kept for later).
 *
 * Reads Amazon's order exports: Retail.OrderHistory (Request your data) and
 * the older Order History Report, by their headers. Only the order id, date,
 * ASIN, product name, prices, quantity, currency and site are read; the
 * file's addresses, payment details and emails are never kept. Nothing here
 * touches coins, ownership or anything in-world: a confirmed line writes the
 * piece's real-world fields (the ones typed by hand in the piece editor).
 *
 *   readOrders(text)          { lines, cancelled } or an OrderImportError
 *   preview(db, { text, showId })   each line: new or duplicate, its
 *                                   suggested piece; nothing stored
 *   confirm(db, { showId, lines })  stores new lines; a line with a piece
 *                                   fills that piece's empty fields
 *   matchLater(db, id, wardrobeId)  an unmatched line onto a piece
 *   listLines(db, { showId, status })
 */

const MAX_LINES = 5000;
const MAX_CONFIRM = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASIN_RE = /^[A-Z0-9]{10}$/i;
const ORDER_RE = /^[A-Z0-9-]{5,40}$/i;
const SITE_RE = /^amazon\.[a-z]{2,3}(\.[a-z]{2})?$/i;

class OrderImportError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'OrderImportError'; }
}

/** RFC 4180 rows: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

// Each field, by the headers the two Amazon exports use.
const HEADERS = {
  order_id: ['order id'],
  order_date: ['order date'],
  asin: ['asin', 'asin/isbn'],
  title: ['product name', 'title'],
  price_paid: ['unit price', 'purchase price per unit'],
  list_price: ['list price per unit'],
  quantity: ['quantity'],
  currency: ['currency'],
  website: ['website'],
  status: ['order status'],
};

/** "$1,299.00" → 1299; "Not Available" or blank → null. */
function money(value) {
  const t = String(value || '').replace(/[^0-9.-]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** "2024-01-15T18:22:11Z" or "01/15/24" → "2024-01-15"; else null. */
function dateOf(value) {
  const t = String(value || '').trim();
  let y; let m; let d;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (iso) [, y, m, d] = iso;
  else if (us) { [, m, d, y] = us; if (y.length === 2) y = `20${y}`; } else return null;
  const out = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const check = new Date(`${out}T00:00:00Z`);
  return !Number.isNaN(check.getTime()) && check.toISOString().slice(0, 10) === out ? out : null;
}

const siteOf = (value) => {
  const t = String(value || '').trim().toLowerCase().replace(/^www\./, '');
  return SITE_RE.test(t) ? t : 'amazon.com';
};

/** The file's order lines (one per order id + ASIN, quantities added), and how many were cancelled. */
function readOrders(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new OrderImportError(400, 'That file has no order lines.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [key, names] of Object.entries(HEADERS)) col[key] = header.findIndex((h) => names.includes(h));
  if (col.order_id < 0 || col.asin < 0 || col.title < 0) {
    throw new OrderImportError(400, "That doesn't look like an Amazon order history CSV (it needs Order ID, ASIN and the product name).");
  }
  if (rows.length - 1 > MAX_LINES) throw new OrderImportError(400, `That file has more than ${MAX_LINES} lines; export a shorter date range.`);
  const at = (row, key) => (col[key] >= 0 ? String(row[col[key]] ?? '').trim() : '');
  const byKey = new Map();
  let cancelled = 0;
  for (const row of rows.slice(1)) {
    const orderId = at(row, 'order_id');
    const asin = at(row, 'asin').toUpperCase();
    const title = at(row, 'title');
    if (!ORDER_RE.test(orderId) || !ASIN_RE.test(asin) || !title) continue;
    if (/cancel/i.test(at(row, 'status'))) { cancelled += 1; continue; }
    const key = `${orderId}|${asin}`;
    const quantity = Math.max(1, Math.min(999, parseInt(at(row, 'quantity'), 10) || 1));
    const seen = byKey.get(key);
    if (seen) { seen.quantity = Math.min(999, seen.quantity + quantity); continue; }
    const currency = at(row, 'currency').toUpperCase();
    byKey.set(key, {
      order_id: orderId, asin, title: title.slice(0, 1000), order_date: dateOf(at(row, 'order_date')),
      price_paid: money(at(row, 'price_paid')), list_price: money(at(row, 'list_price')), quantity,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : null, website: siteOf(at(row, 'website')),
    });
  }
  return { lines: [...byKey.values()], cancelled };
}

const STOP = new Set(['the', 'and', 'for', 'with', 'women', 'womens', 'woman', 'size', 'pack', 'set', 'from', 'new']);
const tokens = (...texts) => new Set(texts.join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)));

/**
 * The piece a line most likely is: one whose product or purchase link holds
 * the ASIN; else the most name words in common (at least two, and most of the
 * piece's name), a brand in the title counting a little. Null when none.
 */
function suggestPiece(line, pieces) {
  const asin = line.asin.toUpperCase();
  const byAsin = pieces.find((p) => [p.real_product_url, p.purchase_link].some((u) => String(u || '').toUpperCase().includes(asin)));
  if (byAsin) return { wardrobe_id: byAsin.id, name: byAsin.name, reason: 'asin' };
  const title = tokens(line.title);
  let best = null;
  for (const p of pieces) {
    const words = tokens(p.name || '', p.real_product_name || '');
    if (!words.size) continue;
    const shared = [...words].filter((w) => title.has(w)).length;
    const brand = [...tokens(p.real_brand || '', p.brand || '')].some((w) => title.has(w)) ? 0.2 : 0;
    const score = shared / words.size + brand;
    if (shared >= 2 && score >= 0.6 && (!best || score > best.score)) best = { wardrobe_id: p.id, name: p.name, reason: 'name', score };
  }
  return best ? { wardrobe_id: best.wardrobe_id, name: best.name, reason: best.reason } : null;
}

async function piecesOf(db, showId) {
  const where = showId ? 'AND show_id = :showId' : '';
  const [rows] = await db.sequelize.query(
    `SELECT id, name, brand, real_brand, real_product_name, real_product_url, purchase_link
       FROM wardrobe WHERE deleted_at IS NULL ${where}`, { replacements: { showId } });
  return rows;
}

async function importedKeys(db, lines) {
  if (!lines.length) return new Set();
  const rows = await db.WardrobeOrderLine.findAll({
    where: { order_id: [...new Set(lines.map((l) => l.order_id))] }, attributes: ['order_id', 'asin'],
  });
  return new Set(rows.map((r) => `${r.order_id}|${r.asin}`));
}

/** The file's lines, each new or a duplicate, with a suggested piece for each new one. Nothing is stored. */
async function preview(db, { text, showId = null }) {
  const { lines, cancelled } = readOrders(text);
  const [done, pieces] = await Promise.all([importedKeys(db, lines), piecesOf(db, showId)]);
  return {
    cancelled,
    lines: lines.map((l) => {
      const duplicate = done.has(`${l.order_id}|${l.asin}`);
      return { ...l, status: duplicate ? 'duplicate' : 'new', suggestion: duplicate ? null : suggestPiece(l, pieces) };
    }),
  };
}

/** The piece's real-world fields an order fills: only those still empty (Evoni, 2026-10-13). */
function fillEmpty(piece, line) {
  const values = {
    real_product_name: line.title.slice(0, 255),
    real_retailer: 'Amazon',
    real_price_paid: line.price_paid,
    real_list_price: line.list_price,
    real_order_date: line.order_date,
    real_product_url: `https://www.${siteOf(line.website)}/dp/${line.asin}`,
    real_source: 'amazon_export',
  };
  const changes = {};
  for (const [key, value] of Object.entries(values)) {
    const now = piece[key];
    if (value != null && value !== '' && (now == null || String(now).trim() === '')) changes[key] = value;
  }
  return changes;
}

async function livePiece(db, id, transaction) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const piece = await db.Wardrobe.findByPk(id, { transaction });
  return piece && !piece.deleted_at ? piece : null;
}

/** Writes the order onto the piece's empty real-world fields; returns what was filled. Never coins. */
async function applyToPiece(piece, line, transaction) {
  const changes = fillEmpty(piece, line);
  if (Object.keys(changes).length) await piece.update({ ...changes, updated_at: new Date() }, { transaction });
  return changes;
}

/** A confirmed line as sent back from the preview, checked again; or null. */
function cleanLine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const orderId = String(raw.order_id || '').trim();
  const asin = String(raw.asin || '').trim().toUpperCase();
  const title = String(raw.title || '').trim();
  if (!ORDER_RE.test(orderId) || !ASIN_RE.test(asin) || !title) return null;
  const currency = String(raw.currency || '').trim().toUpperCase();
  return {
    order_id: orderId, asin, title: title.slice(0, 1000),
    order_date: raw.order_date ? dateOf(raw.order_date) : null,
    price_paid: raw.price_paid == null ? null : money(raw.price_paid),
    list_price: raw.list_price == null ? null : money(raw.list_price),
    quantity: Math.max(1, Math.min(999, parseInt(raw.quantity, 10) || 1)),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    website: siteOf(raw.website),
    wardrobe_id: raw.wardrobe_id || null,
  };
}

/**
 * Stores each new line; a line already imported is a duplicate and left
 * alone. A line with a piece fills that piece's empty real-world fields; a
 * line without one is kept, unmatched, for later.
 */
async function confirm(db, { showId = null, lines }) {
  if (!Array.isArray(lines) || !lines.length) throw new OrderImportError(400, 'Choose at least one order line.');
  if (lines.length > MAX_CONFIRM) throw new OrderImportError(400, `At most ${MAX_CONFIRM} lines at a time.`);
  const out = { matched: 0, unmatched: 0, duplicates: 0, invalid: 0, pieces: [] };
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) { out.invalid += 1; continue; }
    if (line.wardrobe_id && !(await livePiece(db, line.wardrobe_id))) throw new OrderImportError(400, `Piece ${line.wardrobe_id} was not found.`);
    try {
      await db.sequelize.transaction(async (transaction) => {
        const exists = await db.WardrobeOrderLine.findOne({ where: { order_id: line.order_id, asin: line.asin }, transaction });
        if (exists) { out.duplicates += 1; return; }
        const piece = line.wardrobe_id ? await livePiece(db, line.wardrobe_id, transaction) : null;
        await db.WardrobeOrderLine.create({
          ...line, show_id: showId, wardrobe_id: piece ? piece.id : null,
          status: piece ? 'matched' : 'unmatched', matched_at: piece ? new Date() : null,
        }, { transaction });
        if (piece) {
          const filled = await applyToPiece(piece, line, transaction);
          out.matched += 1;
          out.pieces.push({ id: piece.id, filled: Object.keys(filled) });
        } else out.unmatched += 1;
      });
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
      out.duplicates += 1;
    }
  }
  return out;
}

/** An unmatched line onto a piece, filling its empty real-world fields. */
async function matchLater(db, lineId, wardrobeId) {
  if (!UUID_RE.test(String(lineId || ''))) throw new OrderImportError(404, 'Order line not found.');
  return db.sequelize.transaction(async (transaction) => {
    const line = await db.WardrobeOrderLine.findByPk(lineId, { transaction });
    if (!line) throw new OrderImportError(404, 'Order line not found.');
    if (line.status === 'matched') throw new OrderImportError(409, 'That line is already on a piece.');
    const piece = await livePiece(db, wardrobeId, transaction);
    if (!piece) throw new OrderImportError(400, 'Choose a piece.');
    const filled = await applyToPiece(piece, line.get({ plain: true }), transaction);
    await line.update({ wardrobe_id: piece.id, status: 'matched', matched_at: new Date() }, { transaction });
    return { line, piece: { id: piece.id, filled: Object.keys(filled) } };
  });
}

async function listLines(db, { showId = null, status = null } = {}) {
  const where = {};
  if (showId) where.show_id = showId;
  if (status) {
    if (!['matched', 'unmatched'].includes(status)) throw new OrderImportError(400, 'status must be matched or unmatched.');
    where.status = status;
  }
  return db.WardrobeOrderLine.findAll({ where, order: [['order_date', 'DESC'], ['created_at', 'DESC']], limit: 500 });
}

module.exports = {
  OrderImportError, MAX_LINES, MAX_CONFIRM,
  parseCsv, readOrders, suggestPiece, fillEmpty, preview, confirm, matchLater, listLines,
};
