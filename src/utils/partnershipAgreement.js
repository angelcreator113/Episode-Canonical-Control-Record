'use strict';

/**
 * The Creator Partnership Agreement (Task #3206; docs/design/2026-10-lalas-
 * phone.md §13, "In-world documents"; the phase 4 read §2.6): the offer
 * letter's document, drawn as the brand's official agreement. Pure pieces
 * the card (EventDocuments) and the overlay (eventDocumentOverlayService)
 * share, so both say the same thing:
 *
 *   agreementColours(event)  the event's colours for the letterhead, the
 *       rules and the OFFER stamp, from world_events.color_palette (the same
 *       field the invitation is designed from, eventVisualDirection). Only
 *       hex colours are used; a light one colours rules, never text. With
 *       none, the house colours (parchment, gold, lavender ink) stay.
 *   agreementClauses(event, terms)  the numbered clauses: 1 The engagement
 *       (who, what, when, where), then each section of the deal's terms
 *       (offerLetterService.offerTerms) in its order. Lala's personal goals
 *       never appear on it; they stay on her Career list (spec §13).
 *   agreementStatus(lockEpisode)  OFFER until the event has started an
 *       episode (its terms lock, utils/eventTermsLock), EXECUTED after: the
 *       moment she accepted the deal. The schema holds no signature record,
 *       so the lock is the acceptance, as the deal checklist reads it.
 *
 * No logo: there is no brand profile with one yet (phase 4 read §2.6), so
 * the letterhead is the brand's name.
 */

const HOUSE = Object.freeze({
  paper: '#FAF7F0', // --lala-parchment
  rule: '#B8962E', // --lala-gold
  ink: '#2C2C2C', // --lala-ink
  muted: '#6B6B6B',
  head: '#4A3B7A', // --lala-lavender-text
});
const EXECUTED_INK = '#2E6B3F';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexOf(value) {
  const v = typeof value === 'string' ? value.trim() : (value && typeof value === 'object' ? String(value.hex || value.value || '').trim() : '');
  if (!HEX_RE.test(v)) return null;
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase() : v.toUpperCase();
}

/** Relative luminance (WCAG) of a #RRGGBB colour, 0 (black) to 1 (white). */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Dark enough for text on the parchment (about 4.5:1 against #FAF7F0).
const readableOnPaper = (hex) => (luminance(HOUSE.paper) + 0.05) / (luminance(hex) + 0.05) >= 4.5;

function paletteOf(event) {
  let palette = event?.color_palette;
  if (typeof palette === 'string') {
    try { palette = JSON.parse(palette); } catch (err) {
      console.warn('[partnershipAgreement] color_palette is not JSON:', err.message);
      palette = palette.split(',');
    }
  }
  return (Array.isArray(palette) ? palette : []).map(hexOf).filter(Boolean);
}

/** { paper, rule, ink, muted, head, from_event } for the agreement. */
function agreementColours(event) {
  const palette = paletteOf(event);
  if (!palette.length) return { ...HOUSE, from_event: false };
  const head = palette.find(readableOnPaper) || HOUSE.head;
  const rule = palette.find((c) => c !== head) || palette[0];
  return { ...HOUSE, head, rule, from_event: true };
}

const dateText = (event) => {
  const raw = event?.event_date || event?.canon_consequences?.automation?.event_date;
  if (!raw) return null;
  const d = new Date(`${String(raw).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

/** The brand the agreement is with: the host brand, else the host. */
function agreementBrand(event) {
  return String(event?.host_brand || event?.host || 'The host').trim();
}

/** [{ number, key, title, lines }]: 1 The engagement, then the deal's terms sections. */
function agreementClauses(event, terms = []) {
  const brand = agreementBrand(event);
  const venue = event?.venue_name || event?.canon_consequences?.automation?.venue_name || null;
  const when = dateText(event);
  const engagement = [
    `${brand} engages Lala (the Creator) for ${event?.name || 'the event'}`,
    when && `on ${when}`,
    venue && `at ${venue}`,
  ].filter(Boolean).join(' ');
  const clauses = [{ key: 'engagement', title: 'The engagement', lines: [{ label: `${engagement}.`, detail: null, amount: null }] }];
  for (const sec of Array.isArray(terms) ? terms : []) {
    if (sec && Array.isArray(sec.lines) && sec.lines.length) clauses.push({ key: sec.key, title: sec.title, lines: sec.lines });
  }
  return clauses.map((c, i) => ({ number: i + 1, ...c }));
}

/** { status: 'offer' | 'executed', label, colour, episode_id } from the event's terms-lock episode (or null). */
function agreementStatus(lockEpisode, colours = HOUSE) {
  if (lockEpisode?.id) return { status: 'executed', label: 'EXECUTED', colour: EXECUTED_INK, episode_id: lockEpisode.id };
  // In the heading colour, which is always readable on the paper.
  return { status: 'offer', label: 'OFFER', colour: colours.head, episode_id: null };
}

const agreementTitle = (event) => `Creator Partnership Agreement${event?.name ? ` · ${event.name}` : ''}`;

module.exports = { HOUSE, EXECUTED_INK, hexOf, luminance, agreementColours, agreementClauses, agreementStatus, agreementBrand, agreementTitle };
