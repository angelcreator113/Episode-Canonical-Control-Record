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
export const DELIVERABLE_TYPE_MAX = 50;
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
  if (type.length > DELIVERABLE_TYPE_MAX) return { error: `Type: at most ${DELIVERABLE_TYPE_MAX} characters` };
  if (due.length > DELIVERABLE_DUE_MAX) return { error: `Due: at most ${DELIVERABLE_DUE_MAX} characters` };
  return {
    body: {
      description,
      deliverable_type: type || null,
      due_date: due || null,
      required: draft?.required !== false,
    },
  };
}

export function deliverableDraftFrom(d) {
  return {
    description: d?.description || '',
    deliverable_type: d?.deliverable_type || '',
    due_date: d?.due_date || '',
    required: d ? d.required !== false : true,
  };
}

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
