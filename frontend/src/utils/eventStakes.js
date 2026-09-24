/**
 * Event Package stakes and money (Task #1771): what an event is worth and
 * what it costs, in plain words, with the numbers kept apart for a
 * "view details" disclosure.
 *
 * Difficulty here is the PROJECTED difficulty of Evoni's F-Stats-1 decision
 * (docs/audit/F-Stats-1_EventDifficulty_ProjectedVsCanonical_Decision_2026-09-24.md
 * §5): a planning number, never read by evaluation. It is computed by the
 * unchanged calcEventDifficulty (utils/eventReadiness.js).
 * projectEventDifficulty only checks the inputs first: where
 * calcEventDifficulty would quietly substitute a default (a missing or zero
 * prestige or strictness becomes 5, a missing or unknown deadline type
 * weighs as medium, missing keywords count as none), this reports the
 * projection as incomplete and names the missing inputs instead of showing
 * a score.
 *
 * Never fabricate (Task #1771 step 5):
 *   - A field with no stored value is 'missing'. A stored value is
 *     'stored', never 'set': prestige, strictness and cost are NOT NULL
 *     with column defaults (5, 5, 100), deadline_type defaults to 'medium'
 *     and career_tier to 1, and several creation paths derive them from
 *     prestige or pick them at random. Nothing on the row records whether
 *     a value was chosen, so the Package cannot say it was.
 *   - Cost is read-only here. A stored cost cannot be told apart from the
 *     column default (100) or a creation-time derivation (50/150/300/500),
 *     and editing it would not change that: a chosen 100 would still look
 *     like the default. See COST_READ_ONLY_REASON.
 *
 * Pure; no I/O.
 */
import { calcEventDifficulty, eventDifficultyLabel } from './eventReadiness';

// Column defaults (WorldEvent.js / 20260219000003-world-events.js /
// 20260219000004-world-events-career-fields.js). Used only to say that a
// stored value matches its default, never to fill one in.
export const COLUMN_DEFAULTS = { prestige: 5, strictness: 5, cost_coins: 100, deadline_type: 'medium', career_tier: 1 };

// The weight table calcEventDifficulty reads; its keys are the deadline
// types it recognises. Anything else is weighed as medium there.
export const DEADLINE_TYPES = ['none', 'low', 'medium', 'high', 'tonight', 'urgent'];

export const DEADLINE_WORDS = {
  none: 'No deadline pressure',
  low: 'A relaxed timeline',
  medium: 'A normal deadline',
  high: 'A tight deadline',
  tonight: 'It happens tonight',
  urgent: 'An urgent deadline',
};

// The old editor's own labels (WorldAdmin event form, Career Tier select).
export const CAREER_TIERS = {
  1: { label: 'Emerging', reputation: '0–2' },
  2: { label: 'Rising', reputation: '3–4' },
  3: { label: 'Established', reputation: '5–6' },
  4: { label: 'Influential', reputation: '7–8' },
  5: { label: 'Elite', reputation: '9–10' },
};

export const COST_READ_ONLY_REASON =
  'Cost is read-only here. It is always stored (the column cannot be empty, and its default is 100), and several '
  + 'creation paths work it out from prestige, so the Package cannot tell a chosen cost from a default or derived one. '
  + 'Editing it here would not fix that: a cost you chose would look the same. It stays read-only until cost can be left empty.';

export const STORED_ORIGIN_NOTE =
  'These are the values stored on the event. Every event has a prestige, strictness and cost, whether or not anyone '
  + 'chose them (the database fills in a default, and automatic creation paths work some out from prestige), so '
  + '"stored" does not mean chosen.';

const text = (v) => (typeof v === 'string' ? v.trim() : '');

// A positive finite number, or null. Zero and negatives are treated as not
// there, because that is how calcEventDifficulty treats them (`|| 5`).
function positive(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function finiteNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const truthy = new Set([true, 1, '1', 'true', 'yes', 'y']);

/**
 * Projected difficulty, or an incomplete projection.
 * Returns { complete, missing: [{ key, label }], score, label, notes }.
 * score/label (eventDifficultyLabel) are present only when complete.
 * notes lists quirks of the unchanged formula that a reader should know
 * (a deadline of 'none' weighs the same as 'medium').
 */
export function projectEventDifficulty(event) {
  const ev = event || {};
  const missing = [];
  if (positive(ev.prestige) === null) missing.push({ key: 'prestige', label: 'prestige' });
  if (positive(ev.strictness) === null) missing.push({ key: 'strictness', label: 'strictness' });
  if (!DEADLINE_TYPES.includes(ev.deadline_type)) missing.push({ key: 'deadline_type', label: 'deadline type' });
  if (!Array.isArray(ev.dress_code_keywords)) missing.push({ key: 'dress_code_keywords', label: 'dress-code keywords' });

  const notes = [];
  if (ev.deadline_type === 'none') {
    notes.push('The projection weighs a deadline of "none" the same as "medium".');
  }

  if (missing.length) return { complete: false, missing, score: null, label: null, notes };
  const score = calcEventDifficulty(ev);
  return { complete: true, missing, score, label: eventDifficultyLabel(score), notes };
}

function prestigeWords(p) {
  if (p === null) return null;
  if (p >= 8) return 'A major, high-profile event';
  if (p >= 6) return 'A notable event';
  if (p >= 4) return 'A mid-level event';
  return 'A low-key event';
}

function strictnessWords(s) {
  if (s === null) return null;
  if (s >= 9) return 'a very strict room';
  if (s >= 7) return 'a strict room';
  if (s >= 4) return 'a room with some expectations';
  return 'a relaxed room';
}

function careerTier(v) {
  const n = finiteNumber(v);
  return n !== null && CAREER_TIERS[n] ? { value: n, ...CAREER_TIERS[n] } : null;
}

/**
 * Money in plain words, no amounts. Mirrors how the finance paths read the
 * row (financialTransactionService normalizePaidFreeFlags and the
 * financial-forecast route): a paid appearance costs nothing to attend and
 * pays payment_amount; otherwise cost_coins is the attendance cost, and 0
 * means free.
 */
export function describeEventMoney(event) {
  const ev = event || {};
  const cost = finiteNumber(ev.cost_coins);
  if (truthy.has(ev.is_paid)) {
    return { kind: 'paid', summary: 'A paid appearance: Lala is paid to attend, when the episode is finalized.' };
  }
  if (cost === null) return { kind: 'missing', summary: null };
  if (cost <= 0) return { kind: 'free', summary: 'Free to attend.' };
  return { kind: 'cost', summary: 'Lala pays to attend. The cost comes out of her coins when the episode is finalized.' };
}

/**
 * Everything the Stakes and money section shows.
 *   summary: four plain-language rows (career, relationship, challenge,
 *     money), no numbers; a row whose inputs are all missing says so.
 *   details: the numbers behind them, each { key, label, state:
 *     'stored'|'missing', display, note }, for the disclosure.
 *   difficulty: projectEventDifficulty(event).
 */
export function resolveEventStakes(event) {
  const ev = event || {};
  const prestige = positive(ev.prestige);
  const strictness = positive(ev.strictness);
  const deadline = DEADLINE_TYPES.includes(ev.deadline_type) ? ev.deadline_type : null;
  const tier = careerTier(ev.career_tier);
  const cost = finiteNumber(ev.cost_coins);
  const difficulty = projectEventDifficulty(ev);
  const money = describeEventMoney(ev);

  const milestone = text(ev.career_milestone) || null;
  const successUnlock = text(ev.success_unlock) || null;
  const stakes = text(ev.narrative_stakes) || null;
  const failConsequence = text(ev.fail_consequence) || null;

  // Career opportunity
  const careerParts = [];
  if (prestige !== null && tier) careerParts.push(`${prestigeWords(prestige)}, pitched at the ${tier.label} career level.`);
  else if (prestige !== null) careerParts.push(`${prestigeWords(prestige)}. Career level not set.`);
  else if (tier) careerParts.push(`Pitched at the ${tier.label} career level. Prestige not set.`);
  const career = {
    summary: careerParts[0] || null,
    milestone,
    successUnlock,
    missing: prestige === null && !tier && !milestone && !successUnlock,
  };

  // Relationship stakes: the story stakes and what failing costs her.
  const relationship = {
    summary: stakes,
    failConsequence,
    missing: !stakes && !failConsequence,
  };

  // Challenge: projected difficulty in words, then deadline and room.
  const pressure = [
    deadline ? DEADLINE_WORDS[deadline] : null,
    strictnessWords(strictness),
  ].filter(Boolean);
  const challenge = {
    projected: difficulty,
    pressure: pressure.length
      ? `${pressure[0]}${pressure[1] ? `, ${pressure[1]}` : ''}.`.replace(/^./, (c) => c.toUpperCase())
      : null,
  };

  const details = [
    {
      key: 'prestige', label: 'Prestige',
      state: prestige === null ? 'missing' : 'stored',
      display: prestige === null ? null : `${ev.prestige} of 10`,
      note: prestige !== null && Number(ev.prestige) === COLUMN_DEFAULTS.prestige ? 'Matches the column default (5).' : null,
    },
    {
      key: 'strictness', label: 'Strictness',
      state: strictness === null ? 'missing' : 'stored',
      display: strictness === null ? null : `${ev.strictness} of 10`,
      note: strictness !== null && Number(ev.strictness) === COLUMN_DEFAULTS.strictness ? 'Matches the column default (5).' : null,
    },
    {
      key: 'career_tier', label: 'Career tier',
      state: tier ? 'stored' : 'missing',
      display: tier ? `${tier.value}: ${tier.label} (reputation ${tier.reputation})` : null,
      note: tier && tier.value === COLUMN_DEFAULTS.career_tier ? 'Matches the column default (1).' : null,
    },
    {
      key: 'deadline_type', label: 'Deadline type',
      state: deadline ? 'stored' : 'missing',
      display: deadline,
      note: deadline === COLUMN_DEFAULTS.deadline_type
        ? 'Matches the column default (medium).'
        : (!deadline && text(ev.deadline_type) ? `Stored as "${text(ev.deadline_type)}", which the projection does not recognise.` : null),
    },
    {
      key: 'cost_coins', label: 'Cost',
      state: cost === null ? 'missing' : 'stored',
      display: cost === null ? null : `${cost} coins`,
      readOnly: true,
      note: [
        cost === COLUMN_DEFAULTS.cost_coins ? 'Matches the column default (100): it may never have been chosen.' : null,
        money.kind === 'paid' && cost !== null && cost > 0 ? 'Not charged while the event is a paid appearance.' : null,
      ].filter(Boolean).join(' ') || null,
    },
  ];
  if (money.kind === 'paid') {
    const pay = finiteNumber(ev.payment_amount);
    details.push({
      key: 'payment_amount', label: 'Payment',
      state: pay === null ? 'missing' : 'stored',
      display: pay === null ? null : `${pay} coins`,
      readOnly: true,
      note: null,
    });
  }

  return { career, relationship, challenge, money, details, difficulty };
}

// ── Editing: prestige, strictness, deadline type, career tier ──
// All four are in PUT /world/:showId/events/:eventId's allowedFields
// (prestige, strictness, career_tier also in integerFields;
// deadline_type in scalarStringFields). Prestige and strictness are NOT
// NULL, so they are never sent empty. Cost is not editable here.

export const EDITABLE_STAKES = ['prestige', 'strictness', 'deadline_type', 'career_tier'];

const RANGES = { prestige: [1, 10], strictness: [1, 10], career_tier: [1, 5] };

/** Draft values for the edit dialog: the stored value as a string, '' when missing. */
export function stakesDraftFrom(event) {
  const ev = event || {};
  return {
    prestige: positive(ev.prestige) !== null ? String(ev.prestige) : '',
    strictness: positive(ev.strictness) !== null ? String(ev.strictness) : '',
    deadline_type: DEADLINE_TYPES.includes(ev.deadline_type) ? ev.deadline_type : '',
    career_tier: careerTier(ev.career_tier) ? String(ev.career_tier) : '',
  };
}

/**
 * The PUT body for what Evoni changed. Returns { body, unchanged, errors }.
 * An empty draft value means "leave it": a missing field stays missing and
 * a stored one is never cleared from here.
 */
export function buildStakesUpdate(event, draft) {
  const ev = event || {};
  const d = draft || {};
  const body = {};
  const errors = [];

  for (const key of ['prestige', 'strictness', 'career_tier']) {
    const raw = d[key];
    if (raw === '' || raw === null || raw === undefined) continue;
    const n = Number(raw);
    const [min, max] = RANGES[key];
    if (!Number.isInteger(n) || n < min || n > max) {
      errors.push({ key, message: `${key.replace('_', ' ')} must be a whole number from ${min} to ${max}` });
      continue;
    }
    if (finiteNumber(ev[key]) !== n) body[key] = n;
  }

  const dl = d.deadline_type;
  if (dl !== '' && dl !== null && dl !== undefined) {
    if (!DEADLINE_TYPES.includes(dl)) errors.push({ key: 'deadline_type', message: 'Unknown deadline type' });
    else if (ev.deadline_type !== dl) body.deadline_type = dl;
  }

  return { body: errors.length ? {} : body, unchanged: !errors.length && Object.keys(body).length === 0, errors };
}
