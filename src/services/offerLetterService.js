'use strict';

/**
 * offerLetterService — the offer letter (Evoni, 2026-10-24: "this should be
 * more of an offer letter talking about the brand deal opportunity etc. it
 * comes after the invitation"). Her answers the same day: it replaces the
 * career plan; deal events only; a formal letter plus a terms section; and
 * "have it directly after the invitation": on the invitation's beat 5,
 * right after it.
 *
 * The letter is the brand's (or host's) formal offer to Lala: a greeting,
 * the opportunity, then THE TERMS (read live from the deal, never written by
 * the model, so the amounts are the deal's own), what happens next, a
 * closing and a signature.
 *
 *   offerTerms(event, { costs, deliverables })  the terms section (pure)
 *   termsKey(sections)                           a fingerprint of it, saved
 *                                                with each version, so a
 *                                                deal changed after drafting
 *                                                reads "terms changed"
 *   writeOfferLetter(event, { sections, money }) the letter's words: Haiku,
 *                                                a forced tool call, two
 *                                                attempts; words naming an
 *                                                amount the terms do not
 *                                                hold are retried, then the
 *                                                no-AI letter is used; a
 *                                                budget refusal is thrown
 *   fallbackLetter(event)                        the letter with no AI call
 *   normalizeLetter(input)                       an edited letter, capped
 */

const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { isDealEvent, dealPlanOf } = require('../utils/dealComponents');

const MODELS = ['claude-haiku-4-5-20251001'];
const ATTEMPTS = 2;

const LETTER_FIELDS = Object.freeze({
  greeting: 80,
  opening: 600,
  opportunity: 1400,
  next_steps: 600,
  closing: 200,
  sender_name: 120,
  sender_title: 120,
});

const FEE_LABELS = Object.freeze({
  appearance_fee: 'Appearance fee',
  partnership_base_fee: 'Partnership base fee',
  performance_fee: 'Performance fee',
});
const BONUS_LABELS = Object.freeze({ slay: 'Slay', pass: 'Pass', safe: 'Safe' });
const COST_NAMES = Object.freeze({
  entry: 'Entry', travel: 'Travel', glam: 'Glam', styling: 'Styling',
  accommodation: 'Accommodation', extras: 'Extras', other: 'Costs',
});

const coins = (n) => `${Number(n).toLocaleString('en-US')} Prime Coins`;

/** Whether the event gets an offer letter: it has deal terms (Evoni, 2026-10-24). */
function isOfferEvent(event) {
  return isDealEvent(event || {});
}

function parseCanon(event) {
  const cc = event?.canon_consequences;
  if (!cc) return {};
  if (typeof cc === 'string') {
    try { return JSON.parse(cc) || {}; } catch (err) {
      console.error('[OfferLetter] canon_consequences is not JSON:', err.message);
      return {};
    }
  }
  return cc;
}

/** Who the offer is from: the brand when there is one, else the host. */
function offerSender(event) {
  const e = event || {};
  const auto = parseCanon(e).automation || {};
  const host = (auto.host_display_name || e.host || '').trim() || 'The Host';
  const brand = (e.host_brand || '').trim();
  return { org: brand || host, person: host, brand, host };
}

/**
 * The terms section, from the deal (pure): [{ key, title, lines: [{ label,
 * detail, amount }] }], sections without lines left out. costs and
 * deliverables are the event_costs and event_deliverables rows (null when
 * not loaded).
 */
function offerTerms(event, { costs = null, deliverables = null } = {}) {
  const e = event || {};
  const plan = dealPlanOf(e);
  if (!plan) return [];
  const sections = [];

  // What she is paid.
  if (plan.cash) {
    const { completionPayouts } = require('./dealPayoutService');
    const fees = completionPayouts(e, null).map((p) => ({ label: FEE_LABELS[p.category] || 'Fee', detail: '', amount: p.amount }));
    if (fees.length) sections.push({ key: 'fees', title: 'Compensation', lines: fees });
  }
  if (plan.giftedValue) {
    sections.push({ key: 'gifted', title: plan.cash ? 'Also included' : 'Compensation', lines: [{ label: 'Gifted pieces, hers to keep', detail: '', amount: null }] });
  } else if (!plan.cash && plan.entryCovered) {
    sections.push({ key: 'guest', title: 'Compensation', lines: [{ label: 'Attends as our guest', detail: 'No fee; entry covered', amount: null }] });
  }

  // What she delivers.
  if (Array.isArray(deliverables) && deliverables.length) {
    const { contentFeeFor } = require('./dealPayoutService');
    const { withDeliverableTasks } = require('../utils/socialTaskSource');
    const tasks = withDeliverableTasks([], deliverables);
    const byId = new Map(deliverables.map((d) => [String(d.id), d]));
    const lines = tasks.map((t) => {
      const d = byId.get(String(t.deliverable_id));
      const fee = d ? contentFeeFor(e, d) : 0;
      return {
        label: t.label,
        detail: [t.description, t.owed_to === 'brand' ? 'for the brand' : 'for the host', t.required ? 'required' : 'optional'].filter(Boolean).join(' · '),
        amount: fee > 0 ? fee : null,
      };
    });
    if (lines.length) sections.push({ key: 'deliverables', title: 'Deliverables', lines });
  }

  // What she pays (self-funded entry).
  if (plan.selfFunded) {
    const paid = Array.isArray(costs)
      ? costs.filter((c) => c && c.kind === 'entry' && c.paid_by === 'lala').reduce((n, c) => n + (Number(c.amount) || 0), 0)
      : Number(e.cost_coins) || 0;
    if (paid > 0) sections.push({ key: 'entry', title: 'Her investment', lines: [{ label: 'Entry, paid by Lala', detail: '', amount: paid }] });
  }

  // What is covered, and by whom.
  if (Array.isArray(costs)) {
    const covered = costs
      .filter((c) => c && (c.paid_by === 'host' || c.paid_by === 'brand'))
      .map((c) => ({
        label: (c.label && String(c.label).trim()) || COST_NAMES[c.kind] || 'Costs',
        detail: c.paid_by === 'brand' ? `covered by ${(e.host_brand || 'the brand').trim()}` : 'covered by the host',
        amount: null,
      }));
    if (covered.length) sections.push({ key: 'covered', title: 'Covered', lines: covered });
  }

  // The bonus.
  const { normalizeBonusTerms, BONUS_TIERS } = require('./dealPayoutService');
  const bonus = normalizeBonusTerms(e.bonus_terms).value || {};
  const tiers = BONUS_TIERS.filter((t) => Number(bonus[t]) > 0)
    .map((t) => ({ label: `Bonus if her look earns a ${BONUS_LABELS[t]}`, detail: '', amount: Number(bonus[t]) }));
  if (tiers.length) sections.push({ key: 'bonus', title: 'Performance bonus', lines: tiers });

  return sections;
}

/** A fingerprint of the terms section, saved with each version. */
function termsKey(sections) {
  const flat = (sections || []).map((s) => [s.key, (s.lines || []).map((l) => [l.label, l.detail, l.amount ?? null])]);
  return crypto.createHash('sha1').update(JSON.stringify(flat)).digest('hex').slice(0, 16);
}

/** Every coin amount the terms section states. */
function termsAmounts(sections) {
  const out = new Set();
  for (const s of sections || []) for (const l of s.lines || []) if (l.amount != null) out.add(Number(l.amount));
  return out;
}

/** The terms as plain lines, for the prompt. */
function termsText(sections) {
  if (!sections?.length) return '(no terms set yet)';
  return sections.map((s) => `${s.title}:\n${s.lines.map((l) => `- ${l.label}${l.detail ? ` (${l.detail})` : ''}${l.amount != null ? `: ${coins(l.amount)}` : ''}`).join('\n')}`).join('\n');
}

/** An edited (or written) letter, each field trimmed and capped; missing fields ''. */
function normalizeLetter(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const [field, max] of Object.entries(LETTER_FIELDS)) {
    out[field] = typeof src[field] === 'string' ? src[field].trim().slice(0, max) : '';
  }
  return out;
}

/**
 * Coin amounts the letter's words name that the terms do not (the
 * invitation's money check). The terms section carries the amounts, so the
 * words need none; any they name must be one of the terms'.
 */
function checkLetter(letter, sections) {
  const { coinAmounts } = require('./invitationCompositingService');
  const allowed = termsAmounts(sections);
  const written = coinAmounts(Object.keys(LETTER_FIELDS).map((f) => letter?.[f] || '').join(' '));
  const invented = [...written].filter((n) => !allowed.has(n));
  return { amounts: { ok: invented.length === 0, invented } };
}

/** The letter with no AI call: formal, from the event and the deal. */
function fallbackLetter(event) {
  const e = event || {};
  const { invitationFacts } = require('./invitationCompositingService');
  const facts = invitationFacts(e);
  const sender = offerSender(e);
  const when = [facts.eventDate, facts.eventTime].filter(Boolean).join(', ');
  const where = facts.venueName || facts.venueAddress;
  return normalizeLetter({
    greeting: 'Dear Lala,',
    opening: `Following our invitation to ${facts.eventName}, ${sender.org} is pleased to offer you a formal partnership for the event.`,
    opportunity: [
      `We would like you to join us${where ? ` at ${where}` : ''}${when ? ` on ${when}` : ''} as part of ${facts.eventName}.`,
      e.description ? String(e.description).trim() : '',
      e.dress_code ? `The dress code is ${e.dress_code}.` : '',
      'The terms of this offer are set out below.',
    ].filter(Boolean).join(' '),
    next_steps: 'Please confirm your acceptance and we will share the final schedule and contacts ahead of the event.',
    closing: 'With warm regards,',
    sender_name: sender.person,
    sender_title: sender.brand && sender.brand !== sender.person ? `On behalf of ${sender.brand}` : 'Host',
  });
}

const LETTER_TOOL = Object.freeze({
  name: 'write_offer_letter',
  description: 'Return the parts of the offer letter.',
  input_schema: {
    type: 'object',
    properties: {
      greeting: { type: 'string', description: 'e.g. "Dear Lala,"' },
      opening: { type: 'string', description: '1-2 sentences: who is writing and that this is a formal offer, following the invitation.' },
      opportunity: { type: 'string', description: '3-5 sentences: the opportunity, why her, what the partnership involves.' },
      next_steps: { type: 'string', description: '1-2 sentences: how she accepts and what follows.' },
      closing: { type: 'string', description: 'e.g. "With warm regards,"' },
      sender_name: { type: 'string' },
      sender_title: { type: 'string', description: 'e.g. "Head of Partnerships, Maison Rue"' },
    },
    required: ['greeting', 'opening', 'opportunity', 'next_steps', 'closing', 'sender_name', 'sender_title'],
  },
});

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function readLetter(response) {
  const call = (response?.content || []).find((b) => b?.type === 'tool_use' && b.name === LETTER_TOOL.name);
  if (!call?.input) return null;
  const letter = normalizeLetter(call.input);
  return letter.opening && letter.opportunity ? letter : null;
}

/**
 * The letter's words. sections: offerTerms; money: the deal's statement
 * (describeInvitationMoney), for context only. Returns { letter, source:
 * 'claude'|'fallback', checks }.
 */
async function writeOfferLetter(event, { sections = [], money = null } = {}) {
  const e = event || {};
  const { invitationFacts } = require('./invitationCompositingService');
  const facts = invitationFacts(e);
  const sender = offerSender(e);

  const prompt = `You are writing a formal OFFER LETTER in a fashion life simulator show. It follows the event's invitation: the invitation asked Lala to come; this letter makes her the formal offer for the deal.

FROM: ${sender.org}${sender.brand && sender.person !== sender.brand ? ` (signed by ${sender.person})` : ''}
TO: Lala
EVENT: ${e.name}
Venue: ${facts.venueName || facts.venueAddress || 'to be confirmed'}
Date: ${[facts.eventDate, facts.eventTime].filter(Boolean).join(', ') || 'to be confirmed'}
Format: ${e.format ? String(e.format).replace(/_/g, ' ') : (e.event_type || 'event')}
Dress code: ${e.dress_code || 'to be confirmed'}
About: ${String(e.description || e.narrative_stakes || '').slice(0, 400)}
Prestige: ${e.prestige || 5}/10
${money?.text ? `The deal in brief: ${money.text}\n` : ''}
THE TERMS (printed in their own section under your letter; do not restate them):
${termsText(sections)}

Write it as a real brand partnership offer letter: professional, warm, confident, in the sender's voice ("we"). Formal register, no slang, no emoji, no hashtags. Refer to the invitation she has already received. Describe the opportunity and why she is the right partner for it. Do NOT list or restate the terms, and write no coin amount at all: the terms section carries every amount. Never invent an obligation the terms do not hold.

Return it with the write_offer_letter tool.`;

  let feedback = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const messages = [{ role: 'user', content: prompt }];
      if (feedback) messages.push({ role: 'assistant', content: 'Understood.' }, { role: 'user', content: feedback });
      const response = await getClient().messages.create({
        model: MODELS[0],
        max_tokens: 1200,
        tools: [LETTER_TOOL],
        tool_choice: { type: 'tool', name: LETTER_TOOL.name },
        messages,
      });
      const letter = readLetter(response);
      if (!letter) {
        console.error(`[OfferLetter] attempt ${attempt + 1} of ${ATTEMPTS}: no write_offer_letter parts in the answer`);
        continue;
      }
      if (!letter.sender_name) letter.sender_name = sender.person;
      const checks = checkLetter(letter, sections);
      if (checks.amounts.ok) return { letter, source: 'claude', checks };
      console.warn(`[OfferLetter] attempt ${attempt + 1}: the words name ${checks.amounts.invented.join(', ')}, not in the terms`);
      feedback = `Your last draft named ${checks.amounts.invented.map(coins).join(', ')}. Write no coin amount at all: the terms section carries every amount.`;
    } catch (err) {
      if (err?.code === 'AI_BUDGET_EXCEEDED') throw err;
      console.error(`[OfferLetter] attempt ${attempt + 1} of ${ATTEMPTS} failed:`, err.message);
    }
  }
  console.error(`[OfferLetter] Using the no-AI offer letter for: ${e.name}`);
  const letter = fallbackLetter(e);
  return { letter, source: 'fallback', checks: checkLetter(letter, sections) };
}

module.exports = {
  LETTER_FIELDS,
  isOfferEvent,
  offerSender,
  offerTerms,
  termsKey,
  termsText,
  normalizeLetter,
  checkLetter,
  fallbackLetter,
  writeOfferLetter,
};
