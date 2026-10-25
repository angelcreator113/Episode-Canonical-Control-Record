'use strict';

/**
 * eventDocumentsService — the Event Package's in-world documents beside the
 * invitation: Lala's wardrobe shopping list (Evoni, 2026-10-06) and the
 * offer letter (Evoni, 2026-10-24; it replaces the career plan: "this
 * should be more of an offer letter talking about the brand deal
 * opportunity etc. it comes after the invitation"; deal events only; a
 * formal letter plus a terms section; then "have it directly after the
 * invitation": on beat 5, right after the invitation).
 *
 * Each document goes through the invitation's steps: Draft (written from
 * the event), Edit (Evoni's own words), Redraft (a new draft, the old one
 * kept in history) and Approve. It is stored in the event's
 * canon_consequences JSON (documents.<type>), so no schema change:
 *
 *   canon_consequences.documents.shopping_list = {
 *     type, status: 'draft' | 'approved', version,
 *     source: 'draft' | 'edited' | 'restored' | 'line_redraft',
 *     items: [{ slot, label, description, required, piece_id? }],
 *     note?, look_key? (the look's piece ids it was drafted from),
 *     checks? { amounts: { ok, invented } }, restored_from?,
 *     drafted_at, edited_at, approved_at,
 *     history: [ the earlier versions, newest first, at most HISTORY_MAX ]
 *   }
 *   canon_consequences.documents.offer_letter = { the same, with
 *     letter: { greeting, opening, opportunity, next_steps, closing,
 *               sender_name, sender_title } in place of items, and
 *     terms_key: the fingerprint of the deal's terms it was written with;
 *     the terms section itself is read live from the deal (offerLetterService) }
 *
 * A career plan saved before 2026-10-24 stays in the JSON, unread: it is
 * neither shown nor carried into an episode.
 *
 * The shopping list's draft reuses the episode list's writer
 * (todoListService.generateTasks); the offer letter's is
 * offerLetterService.writeOfferLetter. Both are Haiku calls, logged and
 * budget-gated by aiCostTracker, with a no-AI fallback.
 */

const DOC_TYPES = Object.freeze({
  shopping_list: { label: 'Shopping list' },
  offer_letter: { label: 'Offer letter' },
});

const HISTORY_MAX = 10;
const ITEMS_MAX = 20;
const LABEL_MAX = 200;
const DESCRIPTION_MAX = 300;
const NOTE_MAX = 300;
const CLOSET_PER_LINE = 3;

class EventDocumentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isDocType(type) {
  return Object.prototype.hasOwnProperty.call(DOC_TYPES, type);
}

function parseJSON(value, fallback) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (err) {
      console.error('[EventDocuments] unreadable JSON on the event:', err.message);
      return fallback;
    }
  }
  return fallback;
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** The event's two documents, each null until drafted. */
function readDocuments(event) {
  const cc = parseJSON(event?.canon_consequences, {}) || {};
  const docs = cc.documents && typeof cc.documents === 'object' ? cc.documents : {};
  return {
    shopping_list: docs.shopping_list || null,
    offer_letter: docs.offer_letter || null,
  };
}

/**
 * A document's items as stored: a label each (items without one are
 * dropped), trimmed, at most ITEMS_MAX, each keeping the look piece it
 * names (piece_id).
 */
function normalizeItems(type, items) {
  if (!Array.isArray(items)) throw new EventDocumentError(400, 'items must be an array');
  const out = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const label = text(raw.label, LABEL_MAX);
    if (!label) continue;
    const item = {
      slot: text(raw.slot, 60) || `item_${out.length + 1}`,
      label,
      description: text(raw.description, DESCRIPTION_MAX),
      required: raw.required === true,
    };
    if (raw.piece_id != null && raw.piece_id !== '') {
      item.piece_id = String(raw.piece_id).slice(0, 60);
    }
    out.push(item);
    if (out.length >= ITEMS_MAX) break;
  }
  return out;
}

/** The next version of a document; the one it replaces goes into history. */
function nextVersion(prev, type, patch, now = new Date().toISOString()) {
  let history = [];
  if (prev) {
    const earlier = Array.isArray(prev.history) ? prev.history : [];
    const replaced = { ...prev };
    delete replaced.history;
    history = [replaced, ...earlier].slice(0, HISTORY_MAX);
  }
  return {
    type,
    status: 'draft',
    version: (prev?.version || 0) + 1,
    source: 'draft',
    items: [],
    drafted_at: prev?.drafted_at || null,
    edited_at: prev?.edited_at || null,
    approved_at: null,
    // The last overlay drawn from it stays, now out of date
    // (eventDocumentOverlayService.overlayState) until the new version is approved.
    overlay: prev?.overlay || null,
    ...patch,
    updated_at: now,
    history,
  };
}

async function loadEvent(sequelize, showId, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1${transaction ? ' FOR UPDATE' : ''}`,
    { replacements: { eventId, showId }, ...(transaction ? { transaction } : {}) }
  );
  const event = rows && rows[0];
  if (!event) throw new EventDocumentError(404, 'Event not found');
  if (typeof event.outfit_pieces === 'string') event.outfit_pieces = parseJSON(event.outfit_pieces, []);
  return event;
}

// One key of canon_consequences.documents, leaving every other key of the
// event's canon_consequences as it is.
async function writeDocument(sequelize, eventId, type, doc, { transaction } = {}) {
  await sequelize.query(
    `UPDATE world_events
        SET canon_consequences = COALESCE(canon_consequences, '{}'::jsonb)
          || jsonb_build_object('documents',
               COALESCE(canon_consequences->'documents', '{}'::jsonb)
               || jsonb_build_object(CAST(:type AS text), CAST(:doc AS jsonb))),
            updated_at = NOW()
      WHERE id = :eventId AND deleted_at IS NULL`,
    { replacements: { eventId, type, doc: JSON.stringify(doc) }, ...(transaction ? { transaction } : {}) }
  );
  return doc;
}

/**
 * A read-modify-write of one document, in one transaction with the event
 * row locked (audit Low, 2026-10-23), so a draft, an edit and an approval
 * cannot overwrite one another: each reads the version the one before it
 * wrote. `change(prev, event)` returns the document to write, or null to
 * write nothing; it may throw an EventDocumentError. Returns
 * { event, doc, written }.
 *
 * expectedVersion (optional): the version the client last read. When sent
 * and the stored version differs, the write is refused with 409, so an
 * approval never approves a version its sender did not see.
 */
async function changeDocument(sequelize, { showId, eventId, type, expectedVersion }, change) {
  return sequelize.transaction(async (transaction) => {
    const event = await loadEvent(sequelize, showId, eventId, { transaction });
    const prev = readDocuments(event)[type];
    if (expectedVersion != null && Number(prev?.version || 0) !== Number(expectedVersion)) {
      throw new EventDocumentError(409, `The ${DOC_TYPES[type].label.toLowerCase()} changed since you opened it (now version ${prev?.version || 0}). Reload it and try again.`);
    }
    const doc = await change(prev, event);
    if (!doc) return { event, doc: prev, written: false };
    await writeDocument(sequelize, eventId, type, doc, { transaction });
    return { event, doc, written: true };
  });
}

/** An expected version sent by a client: a whole number, or null when absent. */
function readExpectedVersion(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new EventDocumentError(400, 'version must be a whole number');
  return n;
}

/** The look's piece ids as one comparable key (order does not matter). */
function lookKeyOf(pieces) {
  return (Array.isArray(pieces) ? pieces : []).map((p) => (p?.id == null ? '' : String(p.id))).filter(Boolean).sort().join(',');
}

/** Every coin amount a piece of the look can cost: its charge and its price. */
function lookAmounts(look) {
  const out = new Set();
  for (const p of look?.pieces || []) {
    if (p?.charge?.amount != null) out.add(Number(p.charge.amount));
    if (p?.coin_cost != null) out.add(Number(p.coin_cost));
    if (p?.rental_price != null) out.add(Number(p.rental_price));
  }
  if (look?.total != null) out.add(Number(look.total));
  return out;
}

/**
 * Coin amounts a version names that its source does not hold (the
 * invitation's money check, 2026-10-24): a shopping line naming an amount
 * no look piece costs (the list shows each price itself), or an offer
 * letter's words naming one its terms section does not state. Reported on
 * the version, never enforced: her edits stand.
 */
function documentChecks(type, items, { look = null, terms = null, letter = null } = {}) {
  if (type === 'offer_letter') return require('./offerLetterService').checkLetter(letter, terms || []);
  const { coinAmounts } = require('./invitationCompositingService');
  const allowed = lookAmounts(look);
  const written = coinAmounts((items || []).map((i) => `${i.label} ${i.description || ''}`).join(' '));
  const invented = [...written].filter((n) => !allowed.has(n));
  return { amounts: { ok: invented.length === 0, invented } };
}

/** The deal's terms rows (event_costs, event_deliverables); null for a part not loaded. */
async function termsRows(sequelize, event) {
  const { isDealEvent, listEventCosts } = require('./eventCostsService');
  const { listEventDeliverables } = require('./eventTermsService');
  let costs = null;
  let deliverables = null;
  if (isDealEvent(event)) {
    try { costs = await listEventCosts(sequelize, event.id); } catch (err) {
      console.error('[EventDocuments] event_costs read failed (the terms name no costs):', err.message);
    }
    try { deliverables = await listEventDeliverables(sequelize, event.id); } catch (err) {
      console.error('[EventDocuments] event_deliverables read failed (the terms name no deliverables):', err.message);
    }
  }
  return { costs, deliverables };
}

/** The offer letter's terms section, read live from the deal. */
async function offerTermsOf(sequelize, event) {
  const { offerTerms } = require('./offerLetterService');
  return offerTerms(event, await termsRows(sequelize, event));
}

/**
 * What a draft, an edit or a line re-roll is written against: the look and
 * her balance (shopping list); the deal's terms and money (offer letter).
 */
async function draftContext(models, event, type) {
  if (type === 'shopping_list') {
    const { shoppingListContext } = require('./eventDocumentOverlayService');
    const { look, balance } = await shoppingListContext(models.sequelize, event);
    return { look, balance };
  }
  const rows = await termsRows(models.sequelize, event);
  const { offerTerms } = require('./offerLetterService');
  const { describeInvitationMoney } = require('./invitationCompositingService');
  return { terms: offerTerms(event, rows), money: describeInvitationMoney(event, rows) };
}

/** A fresh shopping list's lines. budget: word the pieces to buy for a shortfall. */
async function draftItems(models, event, type, { budget = false, ctx = null } = {}) {
  const { generateTasks } = require('./todoListService');
  const c = ctx || await draftContext(models, event, type);
  const tasks = await generateTasks(event, {
    look: c.look,
    budget: budget && c.look ? { balance: c.balance, total: c.look.total } : null,
  });
  return normalizeItems(type, tasks);
}

/** An offer letter is for deal events only (Evoni, 2026-10-24). */
function assertOfferEvent(event) {
  if (!require('./offerLetterService').isOfferEvent(event)) {
    throw new EventDocumentError(409, 'This event has no deal terms. An offer letter states a deal: set the deal in Terms first.');
  }
}

function assertType(type) {
  if (!isDocType(type)) throw new EventDocumentError(400, `Unknown document: ${type}`);
}

/**
 * Pieces she already owns that could fill a shopping line (2026-10-24,
 * "shop her closet"): for each line the look does not fill with one of her
 * own pieces, up to CLOSET_PER_LINE owned wardrobe pieces of this show on
 * that line, the look's own pieces left out. { [line slot]: [{ id, name,
 * image_url }] }. Read only; picking one is done in the styling game.
 */
async function closetSuggestions(sequelize, event, doc, look) {
  if (!doc?.items?.length) return {};
  const { listSlotOf } = require('./todoListService');
  const lookIds = new Set((look?.pieces || []).map((p) => String(p.id)));
  const hersInLook = new Set((look?.pieces || [])
    .filter((p) => ('charge' in p ? !p.charge : p.is_owned === true))
    .map((p) => listSlotOf(p.category || p.clothing_category)).filter(Boolean));
  const wanted = new Set(doc.items.map((i) => listSlotOf(String(i.slot || '')) || null).filter((sl) => sl && !hersInLook.has(sl)));
  if (wanted.size === 0) return {};
  let rows = [];
  try {
    rows = await sequelize.query(
      `SELECT id, name, clothing_category, s3_url_processed, s3_url, thumbnail_url
         FROM wardrobe
        WHERE show_id = :showId AND is_owned = true AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 300`,
      { replacements: { showId: event.show_id }, type: sequelize.QueryTypes.SELECT }
    );
  } catch (err) {
    console.error('[EventDocuments] closet read failed (no suggestions shown):', err.message);
    return {};
  }
  const out = {};
  for (const r of rows || []) {
    const slot = listSlotOf(r.clothing_category);
    if (!slot || !wanted.has(slot) || lookIds.has(String(r.id))) continue;
    out[slot] = out[slot] || [];
    if (out[slot].length < CLOSET_PER_LINE) {
      out[slot].push({ id: String(r.id), name: r.name || 'A piece', image_url: r.s3_url_processed || r.thumbnail_url || r.s3_url || null });
    }
  }
  return out;
}

/**
 * GET: both documents, the look and her balance, whether the look changed
 * since the shopping list was drafted, pieces from her closet for the
 * list, and the offer letter's state (offerState).
 */
async function getDocuments(models, { showId, eventId }) {
  const event = await loadEvent(models.sequelize, showId, eventId);
  // The look the shopping list adds up and Lala's coins (Evoni, 2026-10-09:
  // the list's total was wrong): the same look and charges as Finalize, read
  // here so every place that shows the list shows one total.
  const { shoppingListContext } = require('./eventDocumentOverlayService');
  const { look, balance } = await shoppingListContext(models.sequelize, event);
  const docs = readDocuments(event);
  const lookKey = look ? lookKeyOf(look.pieces) : '';
  const list = docs.shopping_list;
  return {
    ...docs,
    look: look ? { state: look.state, pieces: look.pieces, total: look.total } : null,
    balance,
    // Saved with the list's version, so every device sees the same answer
    // (it was kept per browser tab before).
    look_changed: Boolean(list && typeof list.look_key === 'string' && list.look_key !== lookKey),
    closet: list ? await closetSuggestions(models.sequelize, event, list, look) : {},
    ...(await offerState(models.sequelize, event, docs.offer_letter)),
  };
}

/**
 * The offer letter's live state: whether the event gets one (deal events
 * only), its terms section from the deal, and whether those terms changed
 * since the letter was written.
 */
async function offerState(sequelize, event, doc) {
  const { isOfferEvent, termsKey } = require('./offerLetterService');
  if (!isOfferEvent(event)) return { offer_eligible: false, offer_terms: [], offer_terms_changed: false };
  const terms = await offerTermsOf(sequelize, event);
  return {
    offer_eligible: true,
    offer_terms: terms,
    offer_terms_changed: Boolean(doc && typeof doc.terms_key === 'string' && doc.terms_key !== termsKey(terms)),
  };
}

/**
 * Draft, or redraft: a new draft written from the event. The items are
 * written by the AI outside the transaction (no row is held locked across
 * a model call); the new version is then built on the document as it
 * stands under the lock. budget (shopping list): the pieces to buy are
 * worded for her shortfall (rent, borrow, a cheaper swap). An offer letter
 * records the terms it was written with (terms_key).
 */
async function draftDocument(models, { showId, eventId, type, version, budget = false }) {
  assertType(type);
  const expectedVersion = readExpectedVersion(version);
  const event = await loadEvent(models.sequelize, showId, eventId);
  if (type === 'offer_letter') assertOfferEvent(event);
  const ctx = await draftContext(models, event, type);
  let items = [];
  let extra;
  if (type === 'offer_letter') {
    const { writeOfferLetter, termsKey } = require('./offerLetterService');
    const written = await writeOfferLetter(event, { sections: ctx.terms, money: ctx.money });
    extra = { letter: written.letter, letter_source: written.source, terms_key: termsKey(ctx.terms), checks: written.checks };
  } else {
    items = await draftItems(models, event, type, { budget: budget === true, ctx });
    extra = { checks: documentChecks(type, items, ctx), look_key: ctx.look ? lookKeyOf(ctx.look.pieces) : '' };
  }
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion }, (prev) => {
    const now = new Date().toISOString();
    return nextVersion(prev, type, { items, source: 'draft', drafted_at: now, edited_at: null, note: prev?.note || null, ...extra }, now);
  });
  return doc;
}

function readNote(note, prev) {
  if (note === undefined) return prev?.note || null;
  if (note === null) return null;
  if (typeof note !== 'string') throw new EventDocumentError(400, 'note must be text');
  return note.trim().slice(0, NOTE_MAX) || null;
}

/**
 * Edit: her own items (and note), or for an offer letter her own words
 * (letter: { greeting, opening, opportunity, next_steps, closing,
 * sender_name, sender_title }; the terms section comes from the deal and is
 * changed in Terms). An edited document is a draft until approved again.
 */
async function editDocument(models, { showId, eventId, type, items, note, letter, version }) {
  assertType(type);
  const expectedVersion = readExpectedVersion(version);
  const event = await loadEvent(models.sequelize, showId, eventId);
  if (type === 'offer_letter') return editOfferLetter(models, { showId, eventId, event, letter, expectedVersion });
  const ctx = { look: (await require('./eventDocumentOverlayService').shoppingListContext(models.sequelize, event)).look };
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion }, (prev) => {
    if (!prev) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet. Draft it first.`);
    const now = new Date().toISOString();
    const clean = normalizeItems(type, items);
    const next = nextVersion(prev, type, {
      items: clean, source: 'edited', edited_at: now, note: readNote(note, prev), checks: documentChecks(type, clean, ctx),
    }, now);
    if (next.items.length === 0) throw new EventDocumentError(400, 'A document needs at least one item');
    return next;
  });
  return doc;
}

async function editOfferLetter(models, { showId, eventId, event, letter, expectedVersion }) {
  const { normalizeLetter } = require('./offerLetterService');
  if (!letter || typeof letter !== 'object') throw new EventDocumentError(400, 'letter must be an object');
  const clean = normalizeLetter(letter);
  if (!clean.opening && !clean.opportunity) throw new EventDocumentError(400, 'The letter needs an opening or a paragraph about the opportunity');
  const terms = await offerTermsOf(models.sequelize, event);
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type: 'offer_letter', expectedVersion }, (prev) => {
    if (!prev) throw new EventDocumentError(404, 'No offer letter yet. Draft it first.');
    const now = new Date().toISOString();
    return nextVersion(prev, 'offer_letter', {
      letter: clean, letter_source: 'edited', source: 'edited', edited_at: now,
      // Her words are checked against the terms as they are now; the
      // letter keeps the terms_key it was written with.
      checks: documentChecks('offer_letter', [], { terms, letter: clean }),
    }, now);
  });
  return doc;
}

/**
 * Restore an earlier version from history as a new draft version (its
 * lines, note and the look it was drafted from; a letter's words and the
 * terms they were written with); the one it replaces goes
 * into history like any other. Undo after Redraft uses it too.
 */
async function restoreDocument(models, { showId, eventId, type, fromVersion, version }) {
  assertType(type);
  const expectedVersion = readExpectedVersion(version);
  const from = readExpectedVersion(fromVersion);
  if (from == null) throw new EventDocumentError(400, 'fromVersion is required');
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion }, (prev) => {
    if (!prev) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet.`);
    const old = (prev.history || []).find((h) => Number(h.version) === from);
    if (!old) throw new EventDocumentError(404, `Version ${from} is not in the kept history.`);
    const now = new Date().toISOString();
    return nextVersion(prev, type, {
      items: type === 'offer_letter' ? [] : normalizeItems(type, old.items || []),
      note: old.note || null,
      ...(old.look_key !== undefined ? { look_key: old.look_key } : {}),
      ...(type === 'offer_letter' ? { letter: old.letter || null, terms_key: old.terms_key ?? null } : {}),
      checks: old.checks || null,
      source: 'restored',
      restored_from: from,
      edited_at: now,
    }, now);
  });
  return doc;
}

/**
 * Re-roll one shopping line (by its index): a new wording from the writer,
 * saved as a new draft version; the other lines are kept as they are.
 */
async function redraftLine(models, { showId, eventId, type, index, version }) {
  assertType(type);
  if (type !== 'shopping_list') throw new EventDocumentError(400, 'Only a shopping list re-words one line; redraft the letter instead.');
  const expectedVersion = readExpectedVersion(version);
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0) throw new EventDocumentError(400, 'index must be a whole number');
  const event = await loadEvent(models.sequelize, showId, eventId);
  const current = readDocuments(event)[type];
  if (!current) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet. Draft it first.`);
  const line = current.items?.[n];
  if (!line) throw new EventDocumentError(404, 'That line is not on the document.');
  const ctx = await draftContext(models, event, type);
  const { redraftDocumentLine } = require('./todoListService');
  const words = await redraftDocumentLine(event, { type, items: current.items, index: n, look: ctx.look || null });
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion: expectedVersion ?? current.version }, (prev) => {
    const items = (prev.items || []).map((it, i) => (i === n ? { ...it, ...words } : it));
    const clean = normalizeItems(type, items);
    const now = new Date().toISOString();
    return nextVersion(prev, type, { items: clean, source: 'line_redraft', edited_at: now, note: prev.note || null, checks: documentChecks(type, clean, ctx) }, now);
  });
  return doc;
}

/** Keep the shopping list for the look as it is now: its look_key is the current look (no new version). */
async function keepListForLook(models, { showId, eventId, version }) {
  const expectedVersion = readExpectedVersion(version);
  const event = await loadEvent(models.sequelize, showId, eventId);
  const { look } = await require('./eventDocumentOverlayService').shoppingListContext(models.sequelize, event);
  const key = look ? lookKeyOf(look.pieces) : '';
  const { doc } = await changeDocument(models.sequelize, { showId, eventId, type: 'shopping_list', expectedVersion }, (prev) => {
    if (!prev) throw new EventDocumentError(404, 'No shopping list yet. Draft it first.');
    return prev.look_key === key ? null : { ...prev, look_key: key };
  });
  return doc;
}

/**
 * The approved document drawn as its overlay (Evoni, 2026-10-07: "i want
 * both the shopping list and career list and invitations as overlays"),
 * recorded on the document as overlay { asset_id, url, version, made_at }.
 * Not placed on a beat ("none of the overlays should be beats for now").
 * A drawing failure leaves the approval as it is.
 */
async function withOverlay(models, event, type, doc) {
  const { makeDocumentOverlay } = require('./eventDocumentOverlayService');
  try {
    const terms = type === 'offer_letter' ? await offerTermsOf(models.sequelize, event) : null;
    const overlay = await makeDocumentOverlay(models, { event, type, doc, terms });
    if (!overlay) return doc;
    // Recorded only on the version it was drawn from: a newer edit that
    // landed while it was drawn is left as it is.
    const { doc: saved } = await changeDocument(models.sequelize, { showId: event.show_id, eventId: event.id, type }, (current) => (
      current && current.version === doc.version ? { ...current, overlay } : null
    ));
    if (type === 'offer_letter' && event.used_in_episode_id) {
      await syncOfferLetterPlacement(models, { event: { ...event, canon_consequences: null }, episodeId: event.used_in_episode_id, overlay });
    }
    return saved && saved.version === doc.version ? saved : doc;
  } catch (err) {
    console.error(`[EventDocuments] ${type} overlay failed (the approval stands):`, err.message);
    return doc;
  }
}

/**
 * Approve: the current version, as it is, and draw its overlay. Approving
 * an approved document whose overlay is missing or out of date draws it again.
 */
async function approveDocument(models, { showId, eventId, type, version }) {
  assertType(type);
  const expectedVersion = readExpectedVersion(version);
  const { overlayState } = require('./eventDocumentOverlayService');
  // The approval is read and written under the event row lock, so it
  // approves the version stored at that moment and never writes an older
  // copy over a newer edit (audit Low, 2026-10-23).
  const { event, doc: prev, written } = await changeDocument(models.sequelize, { showId, eventId, type, expectedVersion }, (current) => {
    if (!current) throw new EventDocumentError(404, `No ${DOC_TYPES[type].label.toLowerCase()} yet. Draft it first.`);
    if (current.status === 'approved') return null;
    const now = new Date().toISOString();
    return { ...current, status: 'approved', approved_at: now, updated_at: now };
  });
  if (written) return withOverlay(models, event, type, prev);
  // Already approved: draw its overlay again when missing or out of date
  // (a shopping list's look total, or an offer letter's terms, changed).
  let lookTotal = null;
  let currentTermsKey = null;
  if (type === 'shopping_list') {
    const { shoppingListContext, shoppingLines } = require('./eventDocumentOverlayService');
    const { look } = await shoppingListContext(models.sequelize, event);
    if (look) lookTotal = shoppingLines(prev, look.pieces).total;
  } else if (type === 'offer_letter') {
    currentTermsKey = require('./offerLetterService').termsKey(await offerTermsOf(models.sequelize, event));
  }
  return overlayState(prev, lookTotal, currentTermsKey) === 'current' ? prev : withOverlay(models, event, type, prev);
}

// ─── The offer letter on beat 5, directly after the invitation ──────────────
//
// Evoni, 2026-10-24: "have it directly after the invitation". The approved
// letter's overlay is the episode's, on the invitation's own beat 5
// (Reveal), starting when the invitation's seconds end
// (INVITATION_DURATION), so nothing comes between them. Placing it goes
// through episodeBeatPlacement.placeOverlayOnBeat, which honours Evoni's
// switch of 2026-10-07 ("none of the overlays should be beats for now"):
// while it is off the letter is linked to the episode and listed on beat 5
// in the Overlays tab, and placed once placing is turned back on, as the
// invitation is.

const OFFER_LETTER_BEAT_NUMBER = 5;

function offerLetterBeat() {
  const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
  return CANONICAL_BEATS.find((b) => b.number === OFFER_LETTER_BEAT_NUMBER) || null;
}

/**
 * Link the event's approved offer letter overlay to the episode and place
 * it on beat 5, directly after the invitation; earlier offer letter overlays of the event lose their
 * placement on the episode. Idempotent; a failure is logged and leaves the
 * approval as it is. overlay: the drawn overlay, else the stored one.
 */
async function syncOfferLetterPlacement(models, { event, episodeId, overlay = null }) {
  const { sequelize } = models;
  if (!episodeId || !event?.id) return { placement: null, anchor: null };
  try {
    let drawn = overlay;
    if (!drawn) {
      const [[row]] = await sequelize.query('SELECT canon_consequences FROM world_events WHERE id = :id', { replacements: { id: event.id } });
      const doc = readDocuments(row || {}).offer_letter;
      drawn = doc && doc.status === 'approved' ? doc.overlay : null;
    }
    if (!drawn?.asset_id) return { placement: null, anchor: null };
    await sequelize.query(
      'UPDATE assets SET episode_id = :episodeId, updated_at = NOW() WHERE id = :assetId',
      { replacements: { episodeId, assetId: drawn.asset_id } }
    );
    if (models.TimelinePlacement) {
      const [others] = await sequelize.query(
        `SELECT id FROM assets
          WHERE asset_type = 'DOCUMENT_OVERLAY' AND id <> :assetId
            AND metadata->>'event_id' = :eventId AND metadata->>'document_type' = 'offer_letter'`,
        { replacements: { assetId: drawn.asset_id, eventId: String(event.id) } }
      );
      const ids = (others || []).map((r) => r.id);
      if (ids.length) await models.TimelinePlacement.destroy({ where: { episode_id: episodeId, asset_id: ids } });
    }
    const { placeOverlayOnBeat } = require('./episodeBeatPlacement');
    const { INVITATION_DURATION } = require('./episodeInvitationOverlayService');
    const placed = await placeOverlayOnBeat(models, {
      episodeId,
      assetId: drawn.asset_id,
      canonicalBeat: offerLetterBeat(),
      label: 'Offer letter',
      kind: 'offer_letter',
      source: 'event-document-offer-letter',
      duration: 6,
      zIndex: 20,
      offsetSeconds: INVITATION_DURATION,
      logTag: '[EventDocuments]',
    });
    return { placement: placed.placement, anchor: placed.anchor };
  } catch (err) {
    console.error('[EventDocuments] offer letter placement failed (the approval stands):', err.message);
    return { placement: null, anchor: null };
  }
}

// ─── Start Episode: the approved documents carried into the episode ─────────
//
// PR 3 of the event documents (Evoni, 2026-10-06: the documents live on the
// event; episodes keep the lists they already have). Start Episode reads the
// event's documents once, and only an approved one is used:
//   - an approved shopping list becomes the episode's wardrobe list
//     (episode_todo_lists.tasks), in place of the standard lines;
//   - an approved offer letter's overlay is linked to the episode on beat 5,
//     directly after the invitation
//     (syncOfferLetterPlacement). Lala's goals are written from the event's
//     fields: the offer letter is the brand's offer, not her goals (it
//     replaced the career plan, whose lines were carried, 2026-10-24).
// A draft is never carried. An episode already started keeps its lists.

/** The event's document of this type, when it is approved; else null. */
function approvedDocument(event, type) {
  const doc = readDocuments(event)[type];
  if (!doc || doc.status !== 'approved') return null;
  if (type === 'offer_letter') return doc.letter && (doc.letter.opening || doc.letter.opportunity) ? doc : null;
  return Array.isArray(doc.items) && doc.items.length ? doc : null;
}

const docTag = (doc) => ({ type: doc.type, version: doc.version });

/** An approved shopping list's lines as the episode's wardrobe tasks. */
function shoppingListTasks(doc) {
  return (doc?.items || []).map((i, n) => ({
    slot: i.slot,
    label: i.label,
    description: i.description || '',
    required: i.required === true,
    completed: false,
    order: n + 1,
    from_event_document: docTag(doc),
  }));
}

// ─── "Use in episode": the approved list applied to an episode (Task #2883) ──
//
// The same tasks Start Episode makes (shoppingListTasks), applied to an
// episode already started. Each task keeps its from_event_document tag
// ({ type, version }), the link to the list; the todo list needs nothing
// more. A Draft list is refused. Applying again adds nothing new:
//   - a list line already on the episode (same slot and label) keeps its
//     task, completed or not;
//   - a new line is added;
//   - an open task the list does not hold (the standard slots, a line an
//     earlier version had) gives way to the list, as at Start Episode;
//   - a completed task the list does not hold is kept: done work is never lost.

const taskKey = (t) => `${String(t?.slot || '').trim().toLowerCase()}|${String(t?.label || '').trim().toLowerCase()}`;

/** The episode and the event that anchors it, or a 404 naming what is missing. */
async function episodeAndEvent(models, episodeId, what) {
  const { sequelize } = models;
  const [[episode]] = await sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId } });
  if (!episode) throw new EventDocumentError(404, 'Episode not found');

  const { listEpisodeEvents } = require('./episodeEventsService');
  const anchor = (await listEpisodeEvents(models, episodeId)).events[0] || null;
  if (!anchor) throw new EventDocumentError(404, `This episode has no event, so it has no ${what}.`);
  const [[event]] = await sequelize.query('SELECT * FROM world_events WHERE id = :id', { replacements: { id: anchor.id } });
  if (!event) throw new EventDocumentError(404, 'Event not found');
  return { episode, event };
}

async function useShoppingListInEpisode(models, episodeId) {
  const { sequelize } = models;
  const { episode, event } = await episodeAndEvent(models, episodeId, 'shopping list');

  const doc = readDocuments(event).shopping_list;
  if (!doc) throw new EventDocumentError(404, 'The event has no shopping list yet. Draft and approve it in the Event Package.');
  if (doc.status !== 'approved') throw new EventDocumentError(409, 'Approve the shopping list in the Event Package before using it in the episode.');
  const listTasks = shoppingListTasks(doc);
  if (!listTasks.length) throw new EventDocumentError(409, 'The approved shopping list has no lines.');

  const [[row]] = await sequelize.query(
    'SELECT id, tasks, deleted_at FROM episode_todo_lists WHERE episode_id = :episodeId',
    { replacements: { episodeId } });
  const live = row && !row.deleted_at;
  const existing = live ? (parseJSON(row.tasks, []) || []) : [];
  const byKey = new Map(existing.map((t) => [taskKey(t), t]));
  const listKeys = new Set(listTasks.map(taskKey));

  const tasks = listTasks.map((t) => {
    const had = byKey.get(taskKey(t));
    return had ? { ...t, completed: had.completed === true } : t;
  });
  const keptDone = existing.filter((t) => t.completed === true && !listKeys.has(taskKey(t)));
  const next = [...tasks, ...keptDone];
  const added = listTasks.filter((t) => !byKey.has(taskKey(t))).length;
  const removed = existing.filter((t) => t.completed !== true && !listKeys.has(taskKey(t))).length;
  const changed = !live || added > 0 || removed > 0
    || JSON.stringify(next.map((t) => [taskKey(t), t.from_event_document?.version ?? null])) !== JSON.stringify(existing.map((t) => [taskKey(t), t.from_event_document?.version ?? null]));

  if (changed) {
    if (row) {
      await sequelize.query(
        `UPDATE episode_todo_lists SET tasks = CAST(:tasks AS jsonb), event_id = :eventId, deleted_at = NULL, updated_at = NOW()
          WHERE id = :id AND episode_id = :episodeId`,
        { replacements: { tasks: JSON.stringify(next), eventId: event.id, id: row.id, episodeId } });
    } else {
      await sequelize.query(
        `INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, status, created_at, updated_at)
         VALUES (:id, :episodeId, :showId, :eventId, CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`,
        { replacements: { id: require('crypto').randomUUID(), episodeId, showId: episode.show_id || null, eventId: event.id, tasks: JSON.stringify(next) } });
    }
  }
  return { added, removed, kept_done: keptDone.length, version: doc.version, tasks: next };
}

module.exports = {
  DOC_TYPES,
  HISTORY_MAX,
  EventDocumentError,
  isDocType,
  readDocuments,
  normalizeItems,
  nextVersion,
  getDocuments,
  draftDocument,
  editDocument,
  approveDocument,
  approvedDocument,
  shoppingListTasks,
  restoreDocument,
  redraftLine,
  keepListForLook,
  documentChecks,
  lookKeyOf,
  useShoppingListInEpisode,
  syncOfferLetterPlacement,
  OFFER_LETTER_BEAT_NUMBER,
  offerState,
};
