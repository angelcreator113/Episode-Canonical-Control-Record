/**
 * Event Package terms (Task #1814, slice 1a): the four kinds of term an
 * event carries (docs/EVENT_EPISODE_FLOW.md §8(t) item 1), each in its own
 * home:
 *   access requirements — event.requirements (object of *_min thresholds)
 *   deliverables        — event_deliverables rows (their own routes)
 *   restrictions        — event.restrictions (array of {type, description})
 *   compensation        — event.is_paid / event.payment_amount
 *
 * Requirements, restrictions and compensation save through the event PUT;
 * the builders here return the PUT body. Deliverables save through
 * /world/:showId/events/:eventId/deliverables (EventTermsSection.jsx).
 *
 * Fulfilment (Task #1815, slice 1b): after Start Episode a deliverable
 * moves pending → completed → submitted → approved, one step at a time,
 * through .../deliverables/:id/status. The helpers at the end mirror the
 * server's rule (validateDeliverableTransition in eventTermsService.js).
 *
 * Pure; no I/O.
 */
import dealTypesMirror from '../constants/dealTypes.json';
import deliverableTypesMirror from '../constants/deliverableTypes.json';
import dealPlansMirror from '../constants/dealPlans.json';
import dealComponentsMirror from '../constants/dealComponents.json';

// The access-requirement keys the next-event suggester checks (the
// suggest-events route in src/routes/careerGoals.js) and the old editor
// writes (WorldAdmin EMPTY_EVENT.requirements).
export const REQUIREMENT_KEYS = [
  { key: 'reputation_min', label: 'Reputation at least' },
  { key: 'brand_trust_min', label: 'Brand trust at least' },
  { key: 'coins_min', label: 'Coins at least' },
];

export const RESTRICTION_TYPE_LABELS = { exclusivity: 'Exclusivity', other: 'Restriction' };
export const RESTRICTION_MAX = 2000;
export const DELIVERABLE_DESCRIPTION_MAX = 2000;
export const DELIVERABLE_DUE_MAX = 50;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function titleCase(key) {
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseMaybeJson(raw, fallback) {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (err) {
    console.error('[eventTerms] could not parse stored value:', err.message);
    return fallback;
  }
}

/** The stored requirements object, or {}. */
export function requirementsOf(event) {
  const r = parseMaybeJson(event?.requirements, {});
  return isPlainObject(r) ? r : {};
}

/**
 * Access requirements for display: the known keys first, then any other
 * key as stored. A value of 0, null or '' is "no requirement" and hidden.
 */
export function describeRequirements(event) {
  const r = requirementsOf(event);
  const out = [];
  const known = new Set(REQUIREMENT_KEYS.map((k) => k.key));
  for (const { key, label } of REQUIREMENT_KEYS) {
    const v = r[key];
    if (v === null || v === undefined || v === '' || Number(v) === 0) continue;
    out.push({ key, label, value: String(v) });
  }
  for (const [key, v] of Object.entries(r)) {
    if (known.has(key) || v === null || v === undefined || v === '') continue;
    out.push({ key, label: titleCase(key), value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
  }
  return out;
}

/** Draft strings for the three known keys; '' when unset or 0. */
export function requirementsDraftFrom(event) {
  const r = requirementsOf(event);
  const draft = {};
  for (const { key } of REQUIREMENT_KEYS) {
    const v = r[key];
    draft[key] = v === null || v === undefined || v === '' || Number(v) === 0 ? '' : String(v);
  }
  return draft;
}

// A comparable form of a requirements object: a known key that is empty
// or 0 counts as absent, known keys compare as numbers.
function requirementsKey(obj) {
  const known = new Set(REQUIREMENT_KEYS.map((k) => k.key));
  return JSON.stringify(Object.keys(obj).sort()
    .filter((k) => !(known.has(k) && (obj[k] === null || obj[k] === undefined || obj[k] === '' || Number(obj[k]) === 0)))
    .map((k) => [k, known.has(k) ? Number(obj[k]) : obj[k]]));
}

/**
 * PUT body for the requirements draft. Other keys already stored are kept
 * as they are; an emptied known key is removed. Returns
 * { body, unchanged, errors }.
 */
export function buildRequirementsUpdate(event, draft) {
  const current = requirementsOf(event);
  const next = { ...current };
  const errors = [];
  for (const { key, label } of REQUIREMENT_KEYS) {
    const raw = String(draft?.[key] ?? '').trim();
    if (raw === '') { delete next[key]; continue; }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      errors.push({ key, message: `${label.replace(/ at least$/, '')} must be a whole number of 0 or more` });
      continue;
    }
    if (n === 0) delete next[key];
    else next[key] = n;
  }
  return { body: { requirements: next }, unchanged: requirementsKey(current) === requirementsKey(next), errors };
}

/** The stored restrictions as [{ type, description }]. */
export function restrictionsOf(event) {
  const raw = parseMaybeJson(event?.restrictions, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (typeof r === 'string' ? { type: 'other', description: r } : r))
    .filter((r) => isPlainObject(r) && typeof r.description === 'string' && r.description.trim())
    .map((r) => ({ type: typeof r.type === 'string' && r.type ? r.type : 'other', description: r.description.trim() }));
}

export function restrictionLabel(type) {
  return RESTRICTION_TYPE_LABELS[type] || titleCase(type || 'other');
}

/** PUT body adding one restriction; { error } when the text is empty or too long. */
export function buildRestrictionAdd(event, text) {
  const description = String(text || '').trim();
  if (!description) return { error: 'Describe the restriction first' };
  if (description.length > RESTRICTION_MAX) return { error: `At most ${RESTRICTION_MAX} characters` };
  return { body: { restrictions: [...restrictionsOf(event), { type: 'other', description }] } };
}

/** PUT body removing the restriction at `index`. */
export function buildRestrictionRemove(event, index) {
  const list = restrictionsOf(event);
  return { body: { restrictions: list.filter((_, i) => i !== index) } };
}

/** Compensation for display. */
export function describeCompensation(event) {
  const paid = event?.is_paid === true || event?.is_paid === 'true';
  const amount = Number(event?.payment_amount);
  return {
    isPaid: paid,
    amount: Number.isFinite(amount) ? amount : 0,
    // An unpaid event can still carry an agreed amount from its opportunity:
    // the pay is recorded as a term, and payout waits on the money slice
    // (Evoni, 2026-09-24).
    summary: paid
      ? `Paid: ${Number.isFinite(amount) ? amount : 0} coins`
      : (Number.isFinite(amount) && amount > 0 ? `Agreed: ${amount} coins (not paid out)` : 'Unpaid'),
  };
}

export function compensationDraftFrom(event) {
  const c = describeCompensation(event);
  return { is_paid: c.isPaid, payment_amount: c.amount ? String(c.amount) : '' };
}

/**
 * PUT body for the compensation draft: is_paid and payment_amount (an
 * INTEGER column). Unpaid keeps the stored amount, so an agreed amount
 * carried from an opportunity is not erased. Returns
 * { body, unchanged, errors }.
 */
export function buildCompensationUpdate(event, draft) {
  const current = describeCompensation(event);
  const errors = [];
  const isPaid = !!draft?.is_paid;
  let amount = current.amount > 0 ? current.amount : 0;
  if (isPaid) {
    const raw = String(draft?.payment_amount ?? '').trim();
    const n = Number(raw);
    if (raw === '' || !Number.isInteger(n) || n <= 0) {
      errors.push({ key: 'payment_amount', message: 'A paid appearance needs a whole number of coins above 0' });
    } else {
      amount = n;
    }
  }
  return {
    body: { is_paid: isPaid, payment_amount: amount },
    unchanged: current.isPaid === isPaid && current.amount === amount,
    errors,
  };
}

/**
 * Validates a deliverable form. Returns { body } for the deliverable
 * routes, or { error }.
 */
export function buildDeliverableBody(draft) {
  const description = String(draft?.description || '').trim();
  if (!description) return { error: 'Describe the deliverable first' };
  if (description.length > DELIVERABLE_DESCRIPTION_MAX) return { error: `At most ${DELIVERABLE_DESCRIPTION_MAX} characters` };
  const type = String(draft?.deliverable_type || '').trim();
  const due = String(draft?.due_date || '').trim();
  if (type && !DELIVERABLE_TYPES.includes(type)) return { error: 'Type: choose one of the listed types' };
  if (due.length > DELIVERABLE_DUE_MAX) return { error: `Due: at most ${DELIVERABLE_DUE_MAX} characters` };
  const body = {
    description,
    deliverable_type: type || null,
    due_date: due || null,
    required: draft?.required !== false,
    owed_to: draft?.owed_to === 'brand' ? 'brand' : 'host',
  };
  // D15: the platform (one the format is on) and the quantity (pieces,
  // slides or days), sent with a chosen format.
  const format = DELIVERABLE_FORMATS[type];
  if (format) {
    const platforms = format.platforms;
    const platform = String(draft?.platform || '').trim();
    if (platform && !platforms.includes(platform)) return { error: `Platform: ${format.label} is on ${platforms.map((x) => PLATFORM_LABELS[x]).join(' or ')}` };
    // A format that names its platform ("1 TikTok GRWM") needs one; the
    // rest take their only platform, or none.
    if (!platform && format.platformInPhrase) return { error: `Platform: choose ${platforms.map((x) => PLATFORM_LABELS[x]).join(', ')}` };
    body.platform = platform || (platforms.length === 1 ? platforms[0] : null);
    const raw = String(draft?.quantity ?? '').trim();
    const quantity = raw === '' ? format.defaultQuantity : Number(raw);
    if (!Number.isInteger(quantity) || quantity < QUANTITY.min || quantity > QUANTITY.max) {
      return { error: `${quantityWord(format)}: a whole number from ${QUANTITY.min} to ${QUANTITY.max}` };
    }
    body.quantity = quantity;
  }
  // A row saved before the fixed list keeps its stored text until a type is
  // chosen: the type is left out of the body rather than erased.
  if (!type && draft?.legacy_type) delete body.deliverable_type;
  // The fee (deal build PR 3, Task #2341), sent only when the form has one.
  if (draft && Object.prototype.hasOwnProperty.call(draft, 'fee')) {
    const raw = String(draft.fee ?? '').trim();
    if (raw === '') body.fee = null;
    else {
      const fee = Number(raw);
      if (!Number.isInteger(fee) || fee < 0) return { error: 'Fee: a whole number of Prime Coins, 0 or more' };
      body.fee = fee;
    }
  }
  return { body };
}

export function deliverableDraftFrom(d) {
  const stored = d?.deliverable_type || '';
  const typed = DELIVERABLE_TYPES.includes(stored);
  return {
    description: d?.description || '',
    deliverable_type: typed ? stored : '',
    legacy_type: !typed && stored ? stored : null,
    platform: typed ? (d?.platform || (DELIVERABLE_FORMATS[stored].platforms.length === 1 ? DELIVERABLE_FORMATS[stored].platforms[0] : '')) : '',
    quantity: typed ? String(d?.quantity ?? DELIVERABLE_FORMATS[stored].defaultQuantity) : '',
    due_date: d?.due_date || '',
    required: d ? d.required !== false : true,
    owed_to: d?.owed_to === 'brand' ? 'brand' : 'host',
    fee: d?.fee == null ? '' : String(d.fee),
  };
}

// Who a deliverable is owed to (T2, §8(bb); Task #2294).
export const DELIVERABLE_OWED_TO_LABELS = { host: 'Host requirement', brand: 'Brand deliverable' };

// ── Fulfilment (Task #1815, slice 1b) ──

export const DELIVERABLE_STATUS_FLOW = ['pending', 'completed', 'submitted', 'approved'];
export const DELIVERABLE_STATUS_LABELS = {
  pending: 'Pending', completed: 'Completed', submitted: 'Submitted', approved: 'Approved',
};
// The timestamp column each status after pending stamps.
export const DELIVERABLE_STATUS_TIMESTAMP = {
  completed: 'completed_at', submitted: 'submitted_at', approved: 'approved_at',
};

/** The known status of a row; anything else reads as pending. */
export function deliverableStatusOf(d) {
  return DELIVERABLE_STATUS_FLOW.includes(d?.status) ? d.status : 'pending';
}

/** The one status a row can move to next, or null at approved. */
export function nextDeliverableStatus(status) {
  const i = DELIVERABLE_STATUS_FLOW.indexOf(status);
  if (i < 0 || i === DELIVERABLE_STATUS_FLOW.length - 1) return null;
  return DELIVERABLE_STATUS_FLOW[i + 1];
}

/** Button text for moving to `next`: "Mark completed", …; null for none. */
export function deliverableAdvanceLabel(next) {
  return next && DELIVERABLE_STATUS_LABELS[next] ? `Mark ${DELIVERABLE_STATUS_LABELS[next].toLowerCase()}` : null;
}

/** A stored timestamp as a short date, or null when absent or unreadable. */
export function formatFulfilmentDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The steps a row has reached, each with its timestamp:
 * [{ status, label, at, text }] in lifecycle order. A step without a
 * stored timestamp is left out.
 */
export function deliverableTimeline(d) {
  const out = [];
  for (const status of DELIVERABLE_STATUS_FLOW.slice(1)) {
    const at = d?.[DELIVERABLE_STATUS_TIMESTAMP[status]];
    const text = formatFulfilmentDate(at);
    if (!text) continue;
    out.push({ status, label: DELIVERABLE_STATUS_LABELS[status], at: new Date(at).toISOString(), text });
  }
  return out;
}

// ─── Deal type (deal build PR 2, Task #2330) ─────────────────────────────
// The eight deal types (docs/DEAL_DESIGN.md §2), mirrored from
// WorldEvent.DEAL_TYPES in constants/dealTypes.json (pinned by
// tests/unit/models/WorldEvent.dealTypeMirror.test.js). The server drafts
// one at creation by a fixed rule (dealTypeDraftService) and records it in
// automation.auto_drafted / drafted_values, as the other drafted fields are
// (doctrine rule 14): Auto-drafted while the column equals the drafted copy,
// Edited once it differs.
export const DEAL_TYPES = dealTypesMirror.deal_type;

export const DEAL_TYPE_LABELS = {
  self_funded: 'Self-funded',
  invited_comped: 'Invited, comped',
  gifted: 'Gifted',
  paid_appearance: 'Paid appearance',
  // D14: the names the derived label gives these combinations (dealLabelFor).
  paid_deliverables: 'Paid content',
  appearance_plus_deliverables: 'Appearance plus content',
  performance_booking: 'Performance booking',
  brand_partnership: 'Brand partnership',
};

const DEAL_TYPE_SOURCE_LABELS = { opportunity: 'opportunity', rule: 'rule' };

/**
 * { value, label, state, note } for the Terms area. state is
 * 'auto_drafted', 'edited', 'set' (a value with no draft behind it) or
 * 'missing'; note is the rule 14 label, or null.
 */
export function describeDealType(event) {
  const value = event?.deal_type || null;
  const automation = event?.canon_consequences?.automation || {};
  const source = automation.auto_drafted?.deal_type || null;
  const drafted = automation.drafted_values || {};
  const hasDraft = Boolean(source) && Object.prototype.hasOwnProperty.call(drafted, 'deal_type');
  let state = value ? 'set' : 'missing';
  if (value && hasDraft) state = drafted.deal_type === value ? 'auto_drafted' : 'edited';
  let note = null;
  if (state === 'auto_drafted') note = `Auto-drafted · ${DEAL_TYPE_SOURCE_LABELS[source] || source}`;
  else if (state === 'edited') note = 'Edited';
  return { value, label: value ? (DEAL_TYPE_LABELS[value] || value) : 'Not set', state, note };
}

/** The event PUT body for a new deal type; unchanged when it equals the stored one. */
export function buildDealTypeUpdate(event, next) {
  const value = next || null;
  if (value !== null && !DEAL_TYPES.includes(value)) return { body: null, unchanged: false, error: 'Choose one of the listed deal types.' };
  return { body: { deal_type: value }, unchanged: value === (event?.deal_type || null), error: null };
}

// ─── Deal components (ruling D14, 2026-09-30; build PR 3) ────────────────
// A deal is the components Evoni ticks; its label is derived. Mirrored from
// src/utils/dealComponents.js in constants/dealComponents.json (pinned by
// tests/unit/utils/dealComponentsMirror.test.js). deal_components null is a
// legacy event, [] a self-funded deal; an event written before the column
// reads its deal_type through the one-to-one map.
export const DEAL_COMPONENT_KEYS = dealComponentsMirror.keys;
export const DEAL_COMPONENT_LABELS = dealComponentsMirror.labels;
const CASH_COMPONENTS = dealComponentsMirror.cash;
const COMPONENTS_BY_DEAL_TYPE = dealComponentsMirror.by_deal_type;

const normalizeComponents = (list) => {
  const set = new Set(Array.isArray(list) ? list : []);
  return DEAL_COMPONENT_KEYS.filter((k) => set.has(k));
};

/** The event's components, or null for a legacy event. */
export function componentsOf(event) {
  let stored = event?.deal_components;
  if (typeof stored === 'string') {
    try { stored = JSON.parse(stored); } catch { stored = null; }
  }
  if (Array.isArray(stored)) return normalizeComponents(stored);
  const base = COMPONENTS_BY_DEAL_TYPE[event?.deal_type];
  if (!base) return null;
  const list = [...base];
  if (event.deal_type === 'brand_partnership' && TRUE_LIKE.has(event?.appearance_required)) list.push('paid_to_appear');
  return normalizeComponents(list);
}

export function isDealEvent(event) {
  return componentsOf(event) !== null;
}

/** The derived label (design note §3.2; answer 2: join the parts). Mirrors dealComponents.dealLabel. */
export function dealLabelFor(eventOrComponents) {
  const keys = Array.isArray(eventOrComponents) ? normalizeComponents(eventOrComponents) : componentsOf(eventOrComponents);
  if (!keys) return null;
  const has = (k) => keys.includes(k);
  const money = keys.filter((k) => k !== 'entry_covered' && k !== 'gifted_items');
  const gifted = has('gifted_items');
  if (keys.length === 0) return 'Self-funded';
  if (money.length === 0) return gifted ? 'Gifted' : 'Invited, comped';
  const withGifted = (label) => (gifted ? `${label} + gifted` : label);
  if (has('partnership_base')) return withGifted(money.length === 1 ? 'Brand partnership (retainer)' : 'Brand partnership');
  const named = {
    paid_to_appear: 'Paid appearance',
    paid_for_content: 'Paid content',
    'paid_to_appear+paid_for_content': 'Appearance plus content',
    performance_fee: 'Performance booking',
    'paid_for_content+performance_fee': 'Performance booking',
  }[money.join('+')];
  if (named) return withGifted(named);
  const PART = { paid_to_appear: 'Paid appearance', paid_for_content: 'content', performance_fee: 'performance fee' };
  return withGifted(money.map((k, i) => (i === 0 ? PART[k] : PART[k].toLowerCase())).join(' + '));
}

/**
 * { components, label, state, note } for the Terms: state 'auto_drafted'
 * while the components equal the drafted copy (drafted_values.deal_components,
 * or before D14 the drafted deal type's components), 'edited' once they
 * differ, 'set' with no draft, 'missing' for a legacy event.
 */
export function describeDealComponents(event) {
  const components = componentsOf(event);
  const automation = event?.canon_consequences?.automation || {};
  const source = automation.auto_drafted?.deal_components || automation.auto_drafted?.deal_type || null;
  const drafted = automation.drafted_values || {};
  let draftedComponents = null;
  if (Array.isArray(drafted.deal_components)) draftedComponents = normalizeComponents(drafted.deal_components);
  else if (drafted.deal_type && COMPONENTS_BY_DEAL_TYPE[drafted.deal_type]) draftedComponents = componentsOf({ deal_type: drafted.deal_type, appearance_required: event?.appearance_required });
  let state = components ? 'set' : 'missing';
  if (components && source && draftedComponents) {
    state = JSON.stringify(draftedComponents) === JSON.stringify(components) ? 'auto_drafted' : 'edited';
  }
  let note = null;
  if (state === 'auto_drafted') note = `Auto-drafted · ${DEAL_TYPE_SOURCE_LABELS[source] || source}`;
  else if (state === 'edited') note = 'Edited';
  return { components, label: components ? dealLabelFor(components) : 'Not set', state, note };
}

/** The event PUT body for the ticked components (null clears the deal); unchanged when they equal the stored ones. */
export function buildDealComponentsUpdate(event, next) {
  if (next === null) return { body: { deal_components: null }, unchanged: componentsOf(event) === null, error: null };
  if (!Array.isArray(next) || next.some((k) => !DEAL_COMPONENT_KEYS.includes(k))) {
    return { body: null, unchanged: false, error: 'Tick only the listed components.' };
  }
  const value = normalizeComponents(next);
  const current = componentsOf(event);
  return { body: { deal_components: value }, unchanged: current !== null && JSON.stringify(current) === JSON.stringify(value), error: null };
}

// ─── Pricing (deal build PR 3, Task #2341) ───────────────────────────────
// Evoni's Deal PR 3 ruling (2026-09-30; docs/EVENT_EPISODE_FLOW.md §8(cc)).
// The deal type decides the components (ruling 4): the appearance fee, the
// brand partnership base (its own component, ruling 1; the appearance is
// added only when the partnership requires it) and the performance fee, each
// in its own event column, plus a fee per deliverable. Deliverables use a
// fixed typed list (ruling 2), since D15 the influencer formats: each takes
// its automatic anchor except Other, which never gets an automatic price
// (ruling 6). A missing price reads "Price required", and
// Start Episode refuses until it has one.
//
// Propose terms (POST .../propose-terms) drafts the numbers from the rate
// card (GET /deal-rates). The server records the draft in
// automation.auto_drafted / drafted_values (rule 14): a number reads
// "Auto-drafted · pricing v<N>" while it equals the drafted copy and Edited
// once it differs. The plans are mirrored from dealPricingService in
// constants/dealPlans.json (pinned by tests/unit/services/dealPlanMirror.test.js).

// The D15 formats (Evoni, 2026-09-30), mirrored from
// src/utils/deliverableFormats.js (pinned by
// tests/unit/services/deliverableTypeMirror.test.js).
export const DELIVERABLE_TYPES = deliverableTypesMirror.deliverable_type;
export const DELIVERABLE_FORMATS = deliverableTypesMirror.formats;
export const PLATFORM_LABELS = deliverableTypesMirror.platform_labels;
const QUANTITY = deliverableTypesMirror.quantity;
export const DELIVERABLE_TYPE_LABELS = Object.fromEntries(
  Object.entries(DELIVERABLE_FORMATS).map(([k, f]) => [k, f.label])
);

/** What a format's quantity counts, as a form label: Quantity, Slides or Days. */
export function quantityWord(format) {
  if (format?.unit === 'day') return 'Days';
  if (format?.unit === 'slide') return 'Slides';
  return 'Quantity';
}

function quantityOf(d, f) {
  const n = Math.trunc(Number(d?.quantity));
  return Number.isFinite(n) && n >= 1 ? n : (f?.defaultQuantity || 1);
}

/**
 * A deliverable's type as shown in the Terms. A row (or type key) of a
 * format reads its label with its quantity ("Instagram Stories (×3)",
 * "Link in bio (7 days)"); an untyped row its stored text; nothing, null.
 */
export function deliverableTypeLabel(dOrType) {
  const d = typeof dOrType === 'string' ? { deliverable_type: dOrType } : dOrType;
  const type = d?.deliverable_type;
  if (!type) return null;
  const f = DELIVERABLE_FORMATS[type];
  if (!f) return `${type} (no type chosen)`;
  const n = quantityOf(d, f);
  if (f.unit === 'day') return `${f.label} (${n} ${n === 1 ? 'day' : 'days'})`;
  return n > 1 ? `${f.label} (×${n})` : f.label;
}

/** The natural phrase ("1 TikTok GRWM", "3 Instagram Stories"), as the server writes it; null when untyped. */
export function deliverablePhrase(d) {
  const f = DELIVERABLE_FORMATS[d?.deliverable_type];
  if (!f) return null;
  const n = quantityOf(d, f);
  const platform = d?.platform && PLATFORM_LABELS[d.platform] ? d.platform : (f.platforms.length === 1 ? f.platforms[0] : null);
  if (f.unit === 'day') {
    const on = platform && f.platforms.length > 1 ? ` on ${PLATFORM_LABELS[platform]}` : '';
    return `Link in bio${on} (${n} ${n === 1 ? 'day' : 'days'})`;
  }
  const noun = n === 1 ? f.noun[0] : f.noun[1];
  return `${n} ${f.platformInPhrase && platform ? `${PLATFORM_LABELS[platform]} ${noun}` : noun}`;
}

const COMPONENTS = dealPlansMirror.components;
const DELIVERABLE_ANCHORS = dealPlansMirror.deliverable_anchors;
const TRUE_LIKE = new Set([true, 'true', 1, '1']);

/**
 * The event's deal plan: { components: [{ key, field, label }], deliverables,
 * cash, giftedValue, known }. Since D14 it comes from the ticked components
 * (dealComponents.dealPlanOf on the server); for every deal type it equals
 * the old per-type plan.
 */
export function dealPlanFor(event) {
  const keys = componentsOf(event);
  if (!keys) return { components: [], deliverables: false, cash: false, giftedValue: false, appearanceIfRequired: false, known: false };
  const has = (k) => keys.includes(k);
  const feeKeys = [
    has('partnership_base') && 'partnership_base',
    has('performance_fee') && 'performance',
    has('paid_to_appear') && 'appearance',
  ].filter(Boolean);
  return {
    components: feeKeys.map((key) => ({ key, ...COMPONENTS[key] })),
    deliverables: has('paid_for_content'),
    cash: CASH_COMPONENTS.some(has),
    giftedValue: has('gifted_items'),
    appearanceIfRequired: false,
    known: true,
  };
}

/** Whether a deliverable format takes an automatic anchor (every D15 format but Other). */
export function hasRateAnchor(type) {
  return Object.prototype.hasOwnProperty.call(DELIVERABLE_ANCHORS, type || '');
}

const coins = (n) => `${Number(n).toLocaleString('en-US')} coins`;

function pricingNote(event, drafted, value) {
  const version = event?.canon_consequences?.automation?.pricing_version ?? event?.pricing_version;
  if (drafted === undefined || value == null) return null;
  if (Number(drafted) !== Number(value)) return 'Edited';
  // A draft with no recorded version names none (the screen read "pricing vnull").
  return version == null ? 'Auto-drafted · pricing' : `Auto-drafted · pricing v${version}`;
}

/** { value, label, note } for one event-level component (appearance_fee, partnership_base_fee, performance_fee). */
export function describeComponentFee(event, field) {
  const value = event?.[field] ?? null;
  const automation = event?.canon_consequences?.automation || {};
  const drafted = automation.auto_drafted?.[field] === 'pricing' ? automation.drafted_values?.[field] : undefined;
  return { value, label: value == null ? 'Price required' : coins(value), note: pricingNote(event, drafted, value) };
}

/** { value, label, note } for the gifted value (ruling 4: recorded, never paid). */
export function describeGiftedValue(event) {
  const value = event?.gifted_value ?? null;
  return { value, label: value == null ? 'Not recorded' : `${coins(value)} in gifts (not paid)`, note: null };
}

/**
 * { value, label, note, priceRequired } for one deliverable's fee. On a deal
 * that pays its deliverables, a missing fee is "Price required".
 */
export function describeDeliverableFee(event, d) {
  const value = d?.fee ?? null;
  const automation = event?.canon_consequences?.automation || {};
  const drafted = automation.auto_drafted?.deliverable_fees === 'pricing' ? automation.drafted_values?.deliverable_fees?.[d?.id] : undefined;
  const priceRequired = value == null && dealPlanFor(event).deliverables;
  let label = null;
  if (value != null) label = `Fee ${coins(value)}`;
  else if (priceRequired) label = 'Price required';
  return { value, label, note: pricingNote(event, drafted, value), priceRequired };
}

// Ruling D12 (Evoni, 2026-09-30; Task #2395): Propose terms drafts the deal's
// deliverables once, scaled to the job, and records each row in
// automation.drafted_values.deliverables ({ <id>: { type, fee, description,
// required, and since D15 platform and quantity } }) with
// auto_drafted.deliverables = 'deal'. A drafted row reads "Auto-drafted ·
// from deal" (doctrine rule 14) until one of those changes, then Edited; a
// row never drafted, null.
export const DELIVERABLE_DRAFT_SOURCE = 'deal';

export function deliverableDraftNote(event, d) {
  const automation = event?.canon_consequences?.automation || {};
  if (automation.auto_drafted?.deliverables !== DELIVERABLE_DRAFT_SOURCE) return null;
  const record = automation.drafted_values?.deliverables?.[d?.id];
  if (!record) return null;
  const sameFee = record.fee == null ? d.fee == null : d.fee != null && Number(record.fee) === Number(d.fee);
  // D15: a record written with a platform and quantity compares them too.
  const samePlatform = record.platform === undefined || (record.platform ?? null) === (d.platform ?? null);
  const sameQuantity = record.quantity === undefined || Number(record.quantity) === Number(d.quantity ?? 1);
  const same = (record.type ?? null) === (d.deliverable_type ?? null)
    && sameFee && samePlatform && sameQuantity
    && (record.description ?? '') === (d.description ?? '')
    && (record.required !== false) === (d.required !== false);
  return same ? 'Auto-drafted · from deal' : 'Edited';
}

/**
 * A deliverable's two notes, said once (Evoni, 2026-10-01: "Auto-drafted"
 * showed twice on one deliverable). { fee, draft }: fee is
 * describeDeliverableFee's, draft is deliverableDraftNote's. A drafted row
 * reads one note, "Auto-drafted · from deal · pricing v<N>", and its fee
 * none; an edited fee on an edited row reads Edited once, on the row.
 */
export function deliverableNotes(event, d) {
  const fee = describeDeliverableFee(event, d);
  let draft = deliverableDraftNote(event, d);
  const feeAuto = typeof fee.note === 'string' && fee.note.startsWith('Auto-drafted');
  if (draft && draft.startsWith('Auto-drafted') && feeAuto) {
    draft = `${draft} · ${fee.note.replace(/^Auto-drafted · /, '')}`;
    return { fee: { ...fee, note: null }, draft };
  }
  if (draft === 'Edited' && fee.note === 'Edited') return { fee: { ...fee, note: null }, draft };
  return { fee, draft };
}

/** Mirror of dealPricingService.missingPrices: what Start Episode waits on, as labels. */
export function missingPriceLabels(event, deliverables = []) {
  const plan = dealPlanFor(event);
  if (!plan.cash) return [];
  const out = plan.components.filter((c) => event?.[c.field] == null).map((c) => c.label);
  if (plan.deliverables) {
    for (const d of Array.isArray(deliverables) ? deliverables : []) {
      if (d?.fee == null) out.push(`"${d.description || deliverableTypeLabel(d) || 'Deliverable'}"`);
    }
  }
  return out;
}

/** The event PUT body for one component's typed value; { error } when it is not a whole number, 0 or more. */
export function buildComponentFeeUpdate(field, raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { body: { [field]: null } };
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) return { error: 'A whole number of Prime Coins, 0 or more' };
  return { body: { [field]: n } };
}

// ─── Performance bonus (deal build PR 5) ────────────────────────────────
// Q12 (EVENT_EPISODE_FLOW.md §8(cc)): "A performance bonus is paid only when
// the accepted deal explicitly contains one; SLAY can trigger that
// contractual bonus." bonus_terms is { slay?, pass?, safe? }: coins by
// evaluation tier, paid at Complete for the tier reached. Propose terms never
// adds one. It locks with the terms.
export const BONUS_TIERS = ['slay', 'pass', 'safe'];
export const BONUS_TIER_LABELS = { slay: 'SLAY', pass: 'PASS', safe: 'SAFE' };

function parseBonusTerms(value) {
  if (value == null) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** { set, label }: the deal's bonus in words ("SLAY 200 · PASS 100"), or none. */
export function describeBonusTerms(event) {
  const terms = parseBonusTerms(event?.bonus_terms);
  const parts = BONUS_TIERS.filter((t) => Number(terms[t]) > 0).map((t) => `${BONUS_TIER_LABELS[t]} ${Number(terms[t])} coins`);
  return parts.length
    ? { set: true, label: parts.join(' · ') }
    : { set: false, label: 'None: the deal contains no bonus' };
}

// D13 (2026-09-30): the bonus Terms drafts on a partnership or a
// performance booking (answer 5) is recorded in
// automation.drafted_values.bonus_terms with auto_drafted.bonus_terms
// 'deal'. It reads Auto-drafted while it equals that copy, then Edited.
export function bonusDraftNote(event) {
  const automation = event?.canon_consequences?.automation || {};
  if (automation.auto_drafted?.bonus_terms !== 'deal' || automation.drafted_values?.bonus_terms == null) return null;
  const current = parseBonusTerms(event?.bonus_terms);
  const drafted = automation.drafted_values.bonus_terms;
  const same = BONUS_TIERS.every((t) => (Number(current[t]) || 0) === (Number(drafted[t]) || 0));
  return same ? 'Auto-drafted · suggested: slay 20%, pass 10% of the cash total' : 'Edited';
}

// D13 answer 6: at most 2 relationship goals, drafted with the deliverables
// and stored as automation.relationship_goals. Not owed: Start Episode
// writes them as Lala's goals, counted in T9's limit.
export function relationshipGoalsOf(event) {
  const goals = event?.canon_consequences?.automation?.relationship_goals;
  return Array.isArray(goals) ? goals.filter((g) => g && String(g.label || '').trim()) : [];
}

export function relationshipGoalsDraftNote(event) {
  const automation = event?.canon_consequences?.automation || {};
  if (automation.auto_drafted?.relationship_goals !== 'deal') return null;
  const same = JSON.stringify(automation.relationship_goals ?? null) === JSON.stringify(automation.drafted_values?.relationship_goals ?? null);
  return same ? 'Auto-drafted · from deal' : 'Edited';
}

/** The event PUT body removing one relationship goal (automation keys replace whole). */
export function buildRelationshipGoalRemove(event, index) {
  const next = relationshipGoalsOf(event).filter((_, i) => i !== index);
  return { body: { canon_consequences: { automation: { relationship_goals: next } } } };
}

/** A form draft: { slay, pass, safe } as strings. */
export function bonusDraftFrom(event) {
  const terms = parseBonusTerms(event?.bonus_terms);
  return Object.fromEntries(BONUS_TIERS.map((t) => [t, terms[t] == null ? '' : String(terms[t])]));
}

/** The event PUT body for a bonus draft: { body } or { error }. Empty tiers are left out; all empty is null. */
export function buildBonusTermsUpdate(draft) {
  const value = {};
  for (const t of BONUS_TIERS) {
    const text = String(draft?.[t] ?? '').trim();
    if (text === '') continue;
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1) return { error: `${BONUS_TIER_LABELS[t]}: a whole number of Prime Coins, 1 or more` };
    value[t] = n;
  }
  return { body: { bonus_terms: Object.keys(value).length ? value : null } };
}

export const PREMIUM_KIND_LABELS = { rush: 'Rush', usage: 'Usage', exclusivity: 'Exclusivity', paid_ad: 'Paid ad' };

/**
 * The premium choices a rate card offers, per kind: [{ kind, label,
 * options: [{ key, percent }] }]. A premium with no percent (paid_ad) is
 * listed with usable: false, since the server refuses it until it is set.
 */
export function premiumChoicesFrom(card) {
  return Object.entries(card?.premiums || {}).map(([kind, keys]) => ({
    kind,
    label: PREMIUM_KIND_LABELS[kind] || kind,
    options: Object.entries(keys).map(([key, percent]) => ({ key, percent, usable: percent != null })),
  }));
}

/**
 * The propose-terms body from the chosen premiums (ruling 3: each applies
 * only to its own component): { premiums: { <component>: [...], deliverables: { <id>: [...] } } }.
 * Only components with a choice are sent.
 */
export function buildProposeBody(selection) {
  const toList = (chosen) => Object.entries(chosen || {}).filter(([, key]) => key).map(([kind, key]) => ({ kind, key }));
  const premiums = {};
  for (const key of Object.keys(COMPONENTS)) {
    const list = toList(selection?.components?.[key]);
    if (list.length) premiums[key] = list;
  }
  const deliverables = {};
  for (const [id, chosen] of Object.entries(selection?.deliverables || {})) {
    const list = toList(chosen);
    if (list.length) deliverables[id] = list;
  }
  premiums.deliverables = deliverables;
  return { premiums };
}
