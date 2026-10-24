'use strict';

/**
 * Invitation Compositing Service v2
 *
 * Takes a generated (Flux, via imageGenerationService) background and composites real, legible
 * invitation text on top using Canvas + Sharp.
 *
 * v2 enhancements:
 *   - Smart layout engine: measures all content first, distributes spacing
 *     proportionally, guarantees no overflow (flexbox-like in Canvas)
 *   - Theme auto-detection from dress_code_keywords when theme is blank
 *   - Font fallback: the committed fonts, else system serif (checkFonts)
 *   - Print export: compositeInvitationPrint() re-composites the approved
 *     card's own words at full quality (a PNG)
 *
 * Fonts: Cormorant Garamond (headers/signature) + Libre Baskerville (body),
 * committed under src/assets/fonts/invitation (OFL 1.1); never downloaded.
 */

// canvas and sharp are optional native dependencies — lazy-loaded to avoid crashing
// the process if they're not installed
let createCanvas, registerFont, sharp;
try {
  ({ createCanvas, registerFont } = require('canvas'));
  sharp = require('sharp');
} catch (err) {
  console.warn('[InvitationCompositing] canvas/sharp not available — compositing disabled:', err.message);
}
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { dealPlanOf, isDealEvent } = require('../utils/dealComponents');
const { isBudgetError } = require('./imageCostService');

// ─── FONT MANAGEMENT ──────────────────────────────────────────────────────────

const FONT_DIR = path.join(__dirname, '../assets/fonts/invitation');

// The fonts ship in the repo (src/assets/fonts/invitation, OFL 1.1; their
// licences sit beside them as *-OFL.txt). Nothing is downloaded at runtime:
// Evoni, 2026-10-01, after production's folder was found holding only
// .gitkeep, so every invitation and title card had used the fallback.
const REQUIRED_FONT_FILES = Object.freeze([
  'CormorantGaramond-Regular.ttf',
  'CormorantGaramond-Bold.ttf',
  'CormorantGaramond-Italic.ttf',
  'LibreBaskerville-Regular.ttf',
  'LibreBaskerville-Italic.ttf',
  'LibreBaskerville-Bold.ttf',
]);

/** The required font files that are missing from FONT_DIR (or too small to be a font). */
function missingFontFiles() {
  return REQUIRED_FONT_FILES.filter((f) => {
    const p = path.join(FONT_DIR, f);
    return !fs.existsSync(p) || fs.statSync(p).size < 10000;
  });
}

let fontsAvailable = false;
let fontsChecked = false;

// ─── FONT FAMILIES (resolved after init) ──────────────────────────────────────
// These get set to either the luxury fonts or system fallbacks
let HEADER_FONT = 'serif';
let BODY_FONT = 'serif';

function registerAllFonts() {
  try {
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Regular.ttf'), { family: 'CormorantGaramond', weight: 'normal', style: 'normal' });
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Bold.ttf'),    { family: 'CormorantGaramond', weight: 'bold',   style: 'normal' });
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Italic.ttf'),  { family: 'CormorantGaramond', weight: 'normal', style: 'italic' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Regular.ttf'),  { family: 'LibreBaskerville',  weight: 'normal', style: 'normal' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Italic.ttf'),   { family: 'LibreBaskerville',  weight: 'normal', style: 'italic' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Bold.ttf'),     { family: 'LibreBaskerville',  weight: 'bold',   style: 'normal' });
    HEADER_FONT = 'CormorantGaramond';
    BODY_FONT = 'LibreBaskerville';
    console.log('[InviteComposite] Custom fonts registered (Cormorant Garamond + Libre Baskerville)');
    return true;
  } catch (err) {
    console.warn('[InviteComposite] Custom font registration failed:', err.message);
    return false;
  }
}

function registerSystemFallback() {
  // Try common system serif fonts available on Linux
  const systemFonts = [
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf',
  ];

  const available = systemFonts.filter(f => fs.existsSync(f));
  if (available.length > 0) {
    try {
      if (fs.existsSync(systemFonts[0])) registerFont(systemFonts[0], { family: 'InvitationSerif', weight: 'normal', style: 'normal' });
      if (fs.existsSync(systemFonts[1])) registerFont(systemFonts[1], { family: 'InvitationSerif', weight: 'bold',   style: 'normal' });
      if (fs.existsSync(systemFonts[2])) registerFont(systemFonts[2], { family: 'InvitationSerif', weight: 'normal', style: 'italic' });
      if (fs.existsSync(systemFonts[3])) registerFont(systemFonts[3], { family: 'InvitationSerif', weight: 'bold',   style: 'italic' });
      HEADER_FONT = 'InvitationSerif';
      BODY_FONT = 'InvitationSerif';
      console.log('[InviteComposite] System fallback fonts registered (Liberation Serif)');
      return true;
    } catch (err) {
      console.warn('[InviteComposite] System font registration failed:', err.message);
    }
  }

  // Last resort — use Canvas built-in serif
  HEADER_FONT = 'serif';
  BODY_FONT = 'serif';
  console.log('[InviteComposite] Using Canvas built-in serif (no custom fonts available)');
  return true;
}

async function checkFonts() {
  if (fontsChecked) return fontsAvailable;
  fontsChecked = true;

  // The committed fonts. A missing file is a deploy fault: it is logged as
  // an error, loudly, every time the fonts are first checked.
  const missing = missingFontFiles();
  if (missing.length === 0 && registerAllFonts()) {
    fontsAvailable = true;
    return true;
  }
  if (missing.length) {
    console.error(`[InviteComposite] FONT FILES MISSING from ${FONT_DIR}: ${missing.join(', ')}. `
      + 'Invitations and title overlays will use a fallback font. The fonts are committed under src/assets/fonts/invitation; redeploy them.');
  }

  // Fall back to system fonts — always succeed
  console.error('[InviteComposite] Custom fonts unavailable — falling back to system fonts');
  registerSystemFallback();
  fontsAvailable = true;
  return true;
}

// ─── COLORS ───────────────────────────────────────────────────────────────────

const _COLORS = {
  gold:       '#B8962E',
  goldLight:  '#D4AF37',
  goldDark:   '#8B6914',
  ink:        '#2C1810',
  inkLight:   '#4A3728',
  cream:      'rgba(255,253,245,0.92)',
  divider:    'rgba(184,150,46,0.4)',
  labelColor: '#8B6914',
};

// ─── THEME AUTO-DETECTION ─────────────────────────────────────────────────────

const KEYWORD_THEME_MAP = {
  'romantic':    'romantic garden',
  'garden':      'romantic garden',
  'floral':      'romantic garden',
  'botanical':   'romantic garden',
  'elegant':     'formal glamour',
  'formal':      'formal glamour',
  'classical':   'formal glamour',
  'black tie':   'formal glamour',
  'couture':     'formal glamour',
  'dramatic':    'power fashion',
  'bold':        'power fashion',
  'editorial':   'power fashion',
  'statement':   'power fashion',
  'minimal':     'chic minimal',
  'clean':       'chic minimal',
  'modern':      'chic minimal',
  'architectural': 'chic minimal',
  'warm':        'honey luxe',
  'honey':       'honey luxe',
  'golden':      'honey luxe',
  'amber':       'honey luxe',
  'blush':       'soft glam',
  'pink':        'soft glam',
  'rose':        'soft glam',
  'feminine':    'soft glam',
  'intimate':    'luxury intimate',
  'velvet':      'luxury intimate',
  'candlelit':   'luxury intimate',
  'evening':     'luxury intimate',
  'avant-garde': 'avant-garde',
  'edgy':        'avant-garde',
  'sculptural':  'avant-garde',
};

function detectTheme(event) {
  if (event.theme) return event.theme.toLowerCase();

  const keywords = [
    ...(event.dress_code_keywords || []),
    ...(event.dress_code || '').split(/[\s,]+/),
    ...(event.mood || '').split(/[\s,]+/),
  ].map(k => k.toLowerCase().trim()).filter(Boolean);

  // Count votes per theme
  const votes = {};
  for (const kw of keywords) {
    const theme = KEYWORD_THEME_MAP[kw];
    if (theme) votes[theme] = (votes[theme] || 0) + 1;
  }

  // Return highest-voted theme, or null for default
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

// ─── TEXT WRAPPING ────────────────────────────────────────────────────────────

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── MONEY LINE (pure) ───────────────────────────────────────────────────────

// is_paid / is_free values that read as yes. is_paid is BOOLEAN
// (WorldEvent.js); older rows and callers sent the strings 'yes' / 'free'
// (Task #2375).
const TRUTHY_FLAG = new Set([true, 1, '1', 'true', 'yes', 'y']);

// Deal fee components, in the order the invitation names them.
const FEE_NAMES = Object.freeze({
  appearance_fee: 'an appearance fee',
  partnership_base_fee: 'a partnership base fee',
  performance_fee: 'a performance fee',
});

const BONUS_TIER_NAMES = Object.freeze({ slay: 'a Slay', pass: 'a Pass', safe: 'a Safe' });

// event_costs kinds (EventCost.KINDS), as a covered line names them.
const COST_KIND_NAMES = Object.freeze({
  entry: 'entry', travel: 'travel', glam: 'glam', styling: 'styling',
  accommodation: 'accommodation', extras: 'extras', other: 'costs',
});

function positiveNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function coins(n) {
  return `${Number(n).toLocaleString('en-US')} Prime Coins`;
}

function joinList(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Sum of the event's entry rows paid by one of `payers`; null when costs were not loaded. */
function entryTotal(costs, payers) {
  if (!Array.isArray(costs)) return null;
  return costs
    .filter((c) => c && c.kind === 'entry' && payers.includes(c.paid_by))
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

function costName(cost) {
  const label = cost?.label && String(cost.label).trim();
  return (label || COST_KIND_NAMES[cost?.kind] || 'costs').toLowerCase();
}

// A typed deliverable by its natural D15 phrase ("1 Pulse video", "3
// Pulse stories", "Profile link (7 days)"); Other and untyped rows by
// their description.
function deliverableName(d) {
  const { deliverablePhrase } = require('../utils/deliverableFormats');
  const phrase = d?.deliverable_type !== 'other' ? deliverablePhrase(d) : null;
  if (phrase) return phrase.startsWith('Profile link') ? `a profile link${phrase.slice('Profile link'.length)}` : phrase;
  const described = d?.description && String(d.description).trim();
  return described ? `"${described}"` : 'a deliverable';
}

// "We are covering your entry / ticket; Maison X is covering your glam."
// The host speaks as "we"; the brand by name. No amounts (the ruling pairs
// amounts with what Lala is paid and pays, not with what is covered).
function coveredSentences(event, costs) {
  if (!Array.isArray(costs)) return [];
  const byPayer = { host: [], brand: [] };
  for (const c of costs) {
    if (c && byPayer[c.paid_by]) byPayer[c.paid_by].push(costName(c));
  }
  const out = [];
  if (byPayer.host.length) out.push(`We are covering your ${joinList(byPayer.host)}.`);
  if (byPayer.brand.length) {
    const brand = (event.host_brand && String(event.host_brand).trim()) || 'The brand';
    out.push(`${brand} is covering your ${joinList(byPayer.brand)}.`);
  }
  return out;
}

// Each deliverable, with its fee when the deal pays for content.
function deliverableSentence(event, deliverables, { withFees }) {
  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return withFees && deliverables === null ? 'We will pay a fee for each piece of content we agree.' : null;
  }
  const { contentFeeFor } = require('./dealPayoutService');
  const parts = deliverables.map((d) => {
    const name = deliverableName(d);
    if (!withFees) return name;
    const fee = contentFeeFor(event, d);
    return fee > 0 ? `${coins(fee)} for ${name}` : `${name} (fee to be confirmed)`;
  });
  return withFees
    ? `For your content, we will pay ${joinList(parts)}.`
    : `In return, we ask for ${joinList(parts)}.`;
}

function bonusSentence(event) {
  const { normalizeBonusTerms, BONUS_TIERS } = require('./dealPayoutService');
  const terms = normalizeBonusTerms(event.bonus_terms).value || {};
  const tiers = BONUS_TIERS.filter((t) => positiveNumber(terms[t]));
  if (!tiers.length) return null;
  const [first, ...rest] = tiers;
  let text = `If your look earns ${BONUS_TIER_NAMES[first]}, we will add a bonus of ${coins(terms[first])}`;
  if (rest.length) text += `; for ${joinList(rest.map((t) => `${BONUS_TIER_NAMES[t]}, ${coins(terms[t])}`))}`;
  return `${text}.`;
}

/**
 * The invitation's statement of the deal (Task #2375), per Evoni's
 * invitation ruling of 2026-09-30 (docs/EVENT_EPISODE_FLOW.md §8(cc)):
 * "The invitation states the deal in the host's voice, in Prime Coins: what
 * Lala is paid (fees, and each deliverable with its fee), what she pays
 * (entry, if self-funded), what is covered and by whom (host or brand), and
 * any bonus with its amount. Comped and gifted events say so without price
 * talk."
 *
 * Pure: `costs` (eventCostsService.listEventCosts) and `deliverables`
 * (eventTermsService.listEventDeliverables) are loaded by the caller; null
 * means not loaded. Fees come from dealPayoutService (completionPayouts,
 * contentFeeFor), the same source the Money tab reads.
 *
 * Legacy events (deal_type null) keep one line: is_paid read as a boolean;
 * paid earns payment_amount, free or cost 0 is complimentary, else the
 * cost_coins entry.
 *
 * Returns { kind: 'earn'|'comped'|'cost'|'neutral', text, sentence }: `text`
 * goes to the prose prompt, `sentence` to the no-AI body.
 */
function describeInvitationMoney(event, { costs = null, deliverables = null } = {}) {
  const e = event || {};

  // D14: the plan comes from the deal's ticked components (its deal_type
  // for an event written before them), one sentence per component, in a
  // fixed order (docs/DEAL_COMPONENTS_DESIGN.md §3.4): as our guest (entry
  // covered, or gifted, on a deal that pays no cash) or the gifted items on
  // a cash deal; the fees; the deliverables; the entry Lala pays
  // (self-funded); what is covered; the bonus. Every backfilled deal type
  // reads as it did before D14.
  if (isDealEvent(e) || e.deal_type) {
    const plan = dealPlanOf(e);
    const done = (kind, sentences) => {
      const text = sentences.filter(Boolean).join(' ');
      return { kind, text, sentence: text };
    };

    if (!plan) return done('neutral', ['The terms will be confirmed.']);

    // Comped and gifted: say so, without price talk.
    if (!plan.cash && (plan.entryCovered || plan.giftedValue)) {
      return done('comped', [
        plan.giftedValue
          ? 'You attend as our gifted guest, with our compliments.'
          : 'You attend as our guest, with our compliments.',
        ...coveredSentences(e, costs),
        deliverableSentence(e, deliverables, { withFees: false }),
      ]);
    }

    const sentences = [];
    let kind = 'neutral';

    if (plan.cash) {
      kind = 'earn';
      const { completionPayouts } = require('./dealPayoutService');
      const fees = completionPayouts(e, null).map((p) => `${FEE_NAMES[p.category] || 'a fee'} of ${coins(p.amount)}`);
      if (fees.length) sentences.push(`We will pay you ${joinList(fees)}.`);
      // Gifted items on a cash deal (a combination no deal type had).
      // INFERRED wording; no value is named, as with a gifted guest.
      if (plan.giftedValue) sentences.push('We are also gifting you pieces to keep.');
      // The deliverables line (§3.4): with their fees when the deal pays for
      // content, else as what is asked in return.
      if (plan.deliverables) sentences.push(deliverableSentence(e, deliverables, { withFees: true }));
      else sentences.push(deliverableSentence(e, deliverables, { withFees: false }));
      if (!fees.length && !(plan.deliverables && sentences.some(Boolean))) sentences.push('Your fee will be confirmed.');
    } else {
      if (plan.selfFunded) {
        const paid = entryTotal(costs, ['lala']);
        const entry = positiveNumber(paid === null ? e.cost_coins : paid);
        if (entry) { kind = 'cost'; sentences.push(`Entry is ${coins(entry)}, paid by you.`); }
        else sentences.push('Entry details will follow.');
      }
      sentences.push(deliverableSentence(e, deliverables, { withFees: false }));
    }

    sentences.push(...coveredSentences(e, costs));
    sentences.push(bonusSentence(e));
    return done(kind, sentences);
  }

  // Legacy event (deal_type null).
  if (TRUTHY_FLAG.has(e.is_paid)) {
    const payment = positiveNumber(e.payment_amount);
    if (!payment) {
      return { kind: 'earn', text: 'a paid engagement for Lala — fee to be confirmed', sentence: 'This is a paid engagement; the fee will be confirmed.' };
    }
    const text = `Lala will earn ${payment} coins for attending`;
    return { kind: 'earn', text, sentence: `${text}.` };
  }
  const isFree = TRUTHY_FLAG.has(e.is_free) || e.is_paid === 'free';
  const cost = e.cost_coins === null || e.cost_coins === undefined || e.cost_coins === '' ? null : Number(e.cost_coins);
  if (isFree || cost === 0) {
    return { kind: 'comped', text: 'complimentary — no cost to attend', sentence: 'This gathering is complimentary.' };
  }
  if (Number.isFinite(cost) && cost > 0) {
    return { kind: 'cost', text: `entry is ${cost} coins`, sentence: `Entry is ${cost} coins.` };
  }
  return { kind: 'neutral', text: 'entry details to follow', sentence: 'Entry details will follow.' };
}

// ─── INVITATION FACTS (pure) ─────────────────────────────────────────────────

function parseCanon(event) {
  const cc = event?.canon_consequences;
  if (!cc) return {};
  if (typeof cc === 'string') {
    try { return JSON.parse(cc) || {}; } catch (err) {
      console.warn('[InviteComposite] canon_consequences is not JSON:', err.message);
      return {};
    }
  }
  return cc;
}

/**
 * The facts an invitation states, read one way for every path (the prose
 * prompt, the no-AI body and the card's signature), so the two can never
 * name different hosts or venues. The host reads as every other reader of
 * the event does (automation.host_display_name, then event.host); venue,
 * address, date and time read the event's own columns first, as Evoni edits
 * them, and the automation snapshot taken at spawn only when a column is
 * empty.
 */
function invitationFacts(event) {
  const e = event || {};
  const auto = parseCanon(e).automation || {};
  const pick = (...values) => values.map((v) => (typeof v === 'string' ? v.trim() : v)).find((v) => v) || '';
  const nameParts = String(e.name || 'Invitation').split(' — ');
  return {
    eventName: nameParts[0].trim() || 'Invitation',
    eventSubtitle: nameParts[1]?.trim() || null,
    hostName: pick(auto.host_display_name, e.host) || 'The Host',
    hostHandle: pick(auto.host_handle),
    hostBrand: pick(e.host_brand),
    venueName: pick(e.venue_name, auto.venue_name),
    venueAddress: pick(e.venue_address, auto.venue_address, e.location_hint),
    eventDate: pick(e.event_date, auto.event_date),
    eventTime: pick(e.event_time, auto.event_time),
    guestNames: (Array.isArray(auto.guest_profiles) ? auto.guest_profiles : [])
      .slice(0, 3).map((g) => g?.display_name || g?.handle).filter(Boolean),
    prestige: e.prestige || 5,
  };
}

// ─── MONEY CHECK (pure) ──────────────────────────────────────────────────────

const COIN_AMOUNT_RE = /(\d[\d,]*)\s*(?:prime\s+)?coins?\b/gi;

function coinAmounts(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(COIN_AMOUNT_RE)) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

/**
 * Whether written invitation text states the money exactly as the terms do
 * (invitation ruling, docs/EVENT_EPISODE_FLOW.md §8(cc): "every amount
 * exactly as written … never invent, round, merge or drop an amount"):
 * every coin amount in the terms appears, and no other coin amount does.
 * Comped and gifted terms carry no amounts, so any amount is invented.
 *
 * @returns {{ ok: boolean, missing: number[], invented: number[] }}
 */
function checkInvitationMoney(content, money) {
  const written = coinAmounts([content?.opening, content?.body, content?.closing].filter(Boolean).join(' '));
  const terms = coinAmounts(money?.text);
  const missing = [...terms].filter((n) => !written.has(n));
  const invented = [...written].filter((n) => !terms.has(n));
  return { ok: missing.length === 0 && invented.length === 0, missing, invented };
}

function moneyCheckFeedback(check) {
  const parts = [];
  if (check.missing.length) parts.push(`it left out ${check.missing.map(coins).join(', ')}`);
  if (check.invented.length) parts.push(`it named ${check.invented.map(coins).join(', ')}, which is not in the terms`);
  return `Your last draft did not state the terms exactly: ${parts.join('; ')}. Write every amount from the terms in digits, exactly as given, and no other amount.`;
}

// ─── CONTENT BUILDER (Claude-powered prose) ──────────────────────────────────

// Side call (CLAUDE.md: Haiku 4.5 for side calls); the two-attempt loop
// below, and every call is logged and budget-gated by aiCostTracker.
const MODELS = ['claude-haiku-4-5-20251001'];

const INVITATION_TOOL = Object.freeze({
  name: 'write_invitation',
  description: 'Return the four parts of the invitation letter.',
  input_schema: {
    type: 'object',
    properties: {
      opening: { type: 'string', description: 'PART 1 — the opening, 1-2 sentences.' },
      body: { type: 'string', description: 'PART 2 — the body, 3-6 sentences of flowing prose.' },
      social: { type: 'string', description: 'PART 3 — the social call-to-action, 1 sentence.' },
      closing: { type: 'string', description: 'PART 4 — the closing line, 1 sentence.' },
    },
    required: ['opening', 'body', 'closing'],
  },
});

let anthropicClient = null;
function getClient() {
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

function invitationPrompt(event, facts, money, { allowsGuest, deliverableText }) {
  const deal = isDealEvent(event);
  return `You are writing a luxury invitation letter for a fashion life simulator show.

The invitation will be printed on a beautiful card and shown on screen. It must read like a real, elegant letter written by a person — not a form, not a template, not labeled fields.

EVENT DETAILS:
Name: ${event.name}
Host: ${facts.hostName}${facts.hostHandle ? ` (${facts.hostHandle})` : ''}
Brand: ${facts.hostBrand}
Venue: ${facts.venueName || 'an exclusive venue'}
Address: ${facts.venueAddress || 'an exclusive venue'}
Date: ${facts.eventDate || 'TBD'}
Time: ${facts.eventTime || 'Evening'}
Dress Code: ${event.dress_code || 'elegant'}
Style Keywords: ${(event.dress_code_keywords || []).join(', ')}
${deal ? 'Terms (the host speaking, in Prime Coins)' : 'Investment'}: ${money.text}
Guest: ${allowsGuest ? 'Plus one is welcome' : 'Lala only — no guests'}
${deliverableText ? `Deliverable: ${deliverableText}` : ''}
Notable Guests: ${facts.guestNames.join(', ') || 'select attendees'}
Atmosphere/Description: ${event.description || event.narrative_stakes || ''}
Prestige Level: ${facts.prestige}/10
Mood: ${event.mood || 'aspirational'}

Write the invitation as FOUR parts and return them with the write_invitation tool.

PART 1 — OPENING (1-2 sentences, 20-35 words):
A beautiful, evocative opening that sets the scene and makes Lala feel chosen and special. No "You are cordially invited" cliché. Make it feel personal and specific to this event's atmosphere.

PART 2 — BODY (3-6 sentences, 50-110 words):
Written as flowing prose — weave in the venue name and address, the date and time, what to expect, the dress code, the ${deal ? 'terms' : 'investment'}, and the guest policy as natural sentences. Do NOT use labels or bullet points. It should read like a person wrote it. ${deal
    ? 'State the terms in the host\'s voice ("we"), as given under Terms: every amount exactly as written, in digits, in Prime Coins, and every item named — what Lala is paid, what she pays, what is covered and by whom, and any bonus. Never invent, round, merge or drop an amount. If the terms say she attends as a guest or gifted guest, say so and mention no price at all.'
    : 'Mention the money terms naturally, exactly as given under Investment (what Lala earns, that she is comped, or what entry costs), amounts in digits; never invent a price.'} If a guest is allowed, mention it warmly. If there's a deliverable, hint at it elegantly. If notable guests are attending, mention 1-2 names casually.

PART 3 — SOCIAL CTA (1 sentence, under 20 words):
A social media call-to-action: what hashtag to use, tagging the host, sharing expectations. Keep it stylish. No amounts.

PART 4 — CLOSING LINE (1 sentence, under 15 words):
An elegant closing that feels warm and anticipatory. No amounts.`;
}

/** The tool call's four parts, or null when the answer carries none. */
function readInvitationParts(response) {
  const call = (response?.content || []).find((b) => b?.type === 'tool_use' && b.name === INVITATION_TOOL.name);
  const input = call?.input;
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  if (!input || !text(input.opening) || !text(input.body)) return null;
  return { opening: text(input.opening), body: text(input.body), social: text(input.social), closing: text(input.closing) };
}

/**
 * The invitation's words: Claude writes them (two attempts; the second is
 * told what the first got wrong about the money), and when neither attempt
 * states the terms exactly — or Claude is unreachable — the no-AI body
 * states them from describeInvitationMoney, so a card never carries a wrong
 * amount. A budget refusal is thrown, not papered over.
 *
 * @param {object} event  world_events row
 * @param {{ costs?: object[]|null, deliverables?: object[]|null }} [options]
 *   the event's event_costs rows (listEventCosts) and event_deliverables rows
 *   (listEventDeliverables), loaded by the caller; the builder stays pure of
 *   the DB.
 * @returns {Promise<{ eventName, eventSubtitle, opening, body, closing,
 *   hostName, hostBrand, prestige, source: 'claude'|'fallback',
 *   moneyCheck: { ok, missing, invented } }>}
 */
async function buildInvitationContent(event, { costs = null, deliverables = null } = {}) {
  const facts = invitationFacts(event);
  const poolSize = event.browse_pool_size || 1;
  const allowsGuest = poolSize >= 2 || event.browse_pool_bias === 'social' || event.browse_pool_bias === 'romantic';
  const money = describeInvitationMoney(event, { costs, deliverables });

  // A deal event's deliverables are stated in its terms (invitation ruling,
  // 2026-09-30); the old hint stays for legacy events only.
  const hasDeliverable = !isDealEvent(event) && (event.event_type === 'brand_deal' || event.event_type === 'deliverable');
  const deliverableText = hasDeliverable
    ? (event.success_unlock?.split(',')[0]?.trim() || 'content creation required')
    : null;

  const frame = {
    eventName: facts.eventName,
    eventSubtitle: facts.eventSubtitle,
    hostName: facts.hostName,
    hostBrand: facts.hostBrand,
    prestige: facts.prestige,
  };

  const prompt = invitationPrompt(event, facts, money, { allowsGuest, deliverableText });
  let feedback = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const messages = [{ role: 'user', content: prompt }];
      if (feedback) messages.push({ role: 'assistant', content: 'Understood.' }, { role: 'user', content: feedback });
      const response = await getClient().messages.create({
        model: MODELS[0],
        max_tokens: 700,
        tools: [INVITATION_TOOL],
        tool_choice: { type: 'tool', name: INVITATION_TOOL.name },
        messages,
      });
      const parts = readInvitationParts(response);
      if (!parts) {
        console.error(`[InviteComposite] invitation prose, try ${attempt + 1}: no write_invitation parts in the answer`);
        continue;
      }
      const content = {
        ...frame,
        opening: parts.opening,
        body: parts.social ? `${parts.body}\n\n${parts.social}` : parts.body,
        closing: parts.closing || 'We look forward to your presence.',
      };
      const moneyCheck = checkInvitationMoney(content, money);
      if (moneyCheck.ok) {
        console.log(`[InviteComposite] Claude wrote invitation prose for: ${event.name}`);
        return { ...content, source: 'claude', moneyCheck };
      }
      console.warn(`[InviteComposite] invitation prose, try ${attempt + 1}: terms not stated exactly (missing ${moneyCheck.missing.join(',') || '-'}, invented ${moneyCheck.invented.join(',') || '-'})`);
      feedback = moneyCheckFeedback(moneyCheck);
    } catch (err) {
      if (isBudgetError(err)) throw err;
      console.warn(`[InviteComposite] invitation prose, try ${attempt + 1} failed: ${err.message}`);
    }
  }

  console.warn(`[InviteComposite] Using the no-AI invitation body for: ${event.name}`);
  const fallback = {
    ...frame,
    opening: 'You have been chosen.',
    body: [
      event.description || event.narrative_stakes
        || `Join us ${facts.venueName ? `at ${facts.venueName}` : (facts.venueAddress ? `at ${facts.venueAddress}` : 'for an exclusive gathering')}.`,
      facts.eventDate ? `${facts.eventDate}${facts.eventTime ? ` · ${facts.eventTime}` : ''}.` : '',
      event.dress_code ? `Please come dressed in ${event.dress_code}.` : '',
      money.sentence,
      allowsGuest ? 'You are welcome to bring a guest.' : '',
    ].filter(Boolean).join(' '),
    closing: 'We look forward to your presence.',
  };
  return { ...fallback, source: 'fallback', moneyCheck: checkInvitationMoney(fallback, money) };
}

/**
 * The card's words from text Evoni typed (no AI): the event's frame
 * (name, host, brand) around her opening, body and closing.
 */
function contentFromText(event, { opening = '', body = '', closing = '' } = {}) {
  const facts = invitationFacts(event);
  return {
    eventName: facts.eventName,
    eventSubtitle: facts.eventSubtitle,
    hostName: facts.hostName,
    hostBrand: facts.hostBrand,
    prestige: facts.prestige,
    opening: String(opening || '').trim(),
    body: String(body || '').trim(),
    closing: String(closing || '').trim() || 'We look forward to your presence.',
  };
}

// ─── CANVAS RENDERER ──────────────────────────────────────────────────────────

function renderTextLayer(content, width = 1024, height = 1792) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ── Cream card overlay ─────────────────────────────────────────────────────
  const cardPadH = width * 0.12;
  const cardPadV = height * 0.08;
  const cardX = cardPadH;
  const cardY = cardPadV;
  const cardW = width - (cardPadH * 2);
  const cardH = height - (cardPadV * 2);
  const radius = 18;

  ctx.beginPath();
  ctx.moveTo(cardX + radius, cardY);
  ctx.lineTo(cardX + cardW - radius, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
  ctx.lineTo(cardX + cardW, cardY + cardH - radius);
  ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
  ctx.lineTo(cardX + radius, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
  ctx.lineTo(cardX, cardY + radius);
  ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,253,245,0.93)';
  ctx.fill();

  // Inner gold border
  const bi = 14;
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const bx = cardX + bi, by = cardY + bi;
  const bw = cardW - (bi * 2), bh = cardH - (bi * 2);
  const br = radius - 4;
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.stroke();

  // ── Layout helpers ─────────────────────────────────────────────────────────
  const cx = cardX + cardW * 0.5;
  const contentW = cardW * 0.76;
  let y = cardY + cardH * 0.055;

  const gap = (n) => { y += n; };

  const drawDivider = () => {
    gap(14);
    ctx.beginPath();
    ctx.moveTo(cx - 50, y);
    ctx.lineTo(cx + 50, y);
    ctx.strokeStyle = 'rgba(212,175,55,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#D4AF37';
    ctx.beginPath();
    ctx.arc(cx, y, 2, 0, Math.PI * 2);
    ctx.fill();
    gap(18);
  };

  const centered = (text, font, color, lh) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, text, contentW);
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += lh || (parseInt(font) * 1.5);
    }
  };

  const centeredItalic = (text, size, color, lh) =>
    centered(text, `italic ${size}px ${HEADER_FONT}`, color, lh || size * 1.5);

  const centeredBold = (text, size, color, lh) =>
    centered(text, `bold ${size}px ${HEADER_FONT}`, color, lh || size * 1.3);

  const bodyText = (text, size, italic = false) => {
    ctx.font = `${italic ? 'italic ' : ''}${size}px ${BODY_FONT}`;
    ctx.fillStyle = '#2C1810';
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, text, contentW);
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += size * 1.7;
    }
  };

  const S = {
    tone:      Math.round(width * 0.021),
    eventName: Math.round(width * 0.056),
    subtitle:  Math.round(width * 0.025),
    greeting:  Math.round(width * 0.026),
    opening:   Math.round(width * 0.021),
    bodySize:  Math.round(width * 0.020),
    closing:   Math.round(width * 0.020),
    warmly:    Math.round(width * 0.021),
    hostName:  Math.round(width * 0.030),
    hostBrand: Math.round(width * 0.019),
  };

  // ── TONE LINE ──────────────────────────────────────────────────────────────
  centeredItalic('An Exclusive Invitation', S.tone, '#8B6914', S.tone * 1.6);

  drawDivider();

  // ── EVENT NAME ─────────────────────────────────────────────────────────────
  centeredBold(content.eventName.toUpperCase(), S.eventName, '#2C1810', S.eventName * 1.15);

  if (content.eventSubtitle) {
    gap(6);
    centeredItalic(content.eventSubtitle, S.subtitle, '#4A3728', S.subtitle * 1.5);
  }

  drawDivider();

  // ── GREETING ───────────────────────────────────────────────────────────────
  centeredItalic('Dearest Lala,', S.greeting, '#2C1810', S.greeting * 1.6);
  gap(10);

  // ── OPENING (Claude's opening line) ────────────────────────────────────────
  if (content.opening) {
    centeredItalic(content.opening, S.opening, '#4A3728', S.opening * 1.7);
    gap(10);
  }

  // ── BODY (Claude's prose) ─────────────────────────────────────────────────
  if (content.body) {
    bodyText(content.body, S.bodySize, false);
  }

  drawDivider();

  // ── CLOSING ────────────────────────────────────────────────────────────────
  centeredItalic(content.closing, S.closing, '#4A3728', S.closing * 1.6);
  gap(18);

  // ── SIGNATURE ──────────────────────────────────────────────────────────────
  centeredItalic('Warmly,', S.warmly, '#4A3728', S.warmly * 1.5);
  gap(4);
  centeredBold(content.hostName, S.hostName, '#2C1810', S.hostName * 1.3);
  if (content.hostBrand) {
    gap(4);
    centered(content.hostBrand, `${S.hostBrand}px ${BODY_FONT}`, '#B8962E', S.hostBrand * 1.5);
  }

  return canvas.toBuffer('image/png');
}

// ─── MAIN COMPOSITE ───────────────────────────────────────────────────────────

/**
 * Composite the invitation's words onto its text-free background.
 * `content` is the card's words (buildInvitationContent or contentFromText);
 * without it Claude writes them. Returns null if canvas/sharp are missing.
 */
async function compositeInvitation(backgroundBuffer, event, content = null, { print = false } = {}) {
  if (!createCanvas || !sharp) return null;
  if (!(await checkFonts())) return null;

  const meta = await sharp(backgroundBuffer).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1792;

  const words = content || await buildInvitationContent(event);
  const textLayer = renderTextLayer(words, width, height);

  return sharp(backgroundBuffer)
    .composite([{ input: textLayer, top: 0, left: 0, blend: 'over' }])
    .png(print ? { quality: 100, compressionLevel: 6 } : { quality: 95 })
    .toBuffer();
}

/**
 * The print-ready PNG of an invitation: the same words as the approved card
 * (never rewritten; the old export asked Claude again, so the printed text
 * differed from the card), re-composited at full quality. A PNG, not a PDF.
 */
async function compositeInvitationPrint(backgroundBuffer, event, content) {
  if (!content) throw new Error('compositeInvitationPrint needs the card\'s words');
  return compositeInvitation(backgroundBuffer, event, content, { print: true });
}

/**
 * The font families checkFonts resolved (the invitation's luxury fonts, the
 * system serif fallback, or Canvas's built-in serif), so other text layers
 * composited onto an episode's images (the task-list overlay, P14, Task
 * #2395) set type the way the invitation does. Call after checkFonts().
 */
function fontFamilies() {
  return { header: HEADER_FONT, body: BODY_FONT };
}

module.exports = {
  compositeInvitation,
  compositeInvitationPrint,
  buildInvitationContent,
  contentFromText,
  invitationFacts,
  checkInvitationMoney,
  describeInvitationMoney,
  detectTheme,
  checkFonts,
  fontFamilies,
  missingFontFiles,
  REQUIRED_FONT_FILES,
  wrapText,
};
