'use strict';

/**
 * Deliverable formats (ruling D15, Evoni, 2026-09-30;
 * docs/EVENT_EPISODE_FLOW.md §8(cc), docs/DEAL_COMPONENTS_DESIGN.md §5).
 *
 * "Deliverables use real influencer formats, each with a platform and
 * quantity and a plain one-line description: Instagram Reel, TikTok video,
 * GRWM video, Instagram Stories (×N), carousel post, Go Live, link in bio
 * (days), try-on/haul video, content for the brand (UGC). Labels read
 * naturally ("1 TikTok GRWM, 3 Instagram Stories"); "Story Set (3)" is
 * renamed "Instagram Stories (×3)". [...] The Tasks list uses the same
 * format names."
 *
 * Answer 8 (2026-09-30) adds "Instagram post" (single photo) at 0.5× the
 * Reel anchor; answers 10–12 set how Stories and link in bio are priced and
 * that the platform does not change the price.
 *
 * The LalaVerse has one social app (Evoni, 2026-10-18: "brand deals ... are
 * currently pointing at Instagram, TikTok, and all those, when now we only
 * have things that Lalaverse has"; "merge tiktok into pulse video"; "yes it
 * can name private accounts"). The formats are The Pulse's: a Reel and a
 * TikTok video are one Pulse video, Instagram Stories are Pulse stories, an
 * Instagram post is a Pulse post, and a piece goes on The Pulse, a private
 * Pulse account or The PlayRoom (utils/pulsePlatform). Migration
 * 20261018130000-pulse-deliverables renamed the rows and the rate card.
 *
 * This file is the source of truth; frontend/src/constants/deliverableTypes.json
 * mirrors it (pinned by tests/unit/services/deliverableTypeMirror.test.js).
 *
 * Each format:
 *   label      the Terms label ("Pulse stories")
 *   noun       [singular, plural] for the natural phrase ("3 Pulse stories")
 *   platforms  the accounts it can go on; the first is the default; [] = none
 *   unit       what the quantity counts: 'piece', 'slide' or 'day'
 *   anchor     the deal_rate_anchors component that prices it, or null
 *   pricing    'per_unit' (anchor × quantity), 'per_slide_of_3' (answer 10:
 *              the 3-slide anchor ÷ 3 × N, rounded to the nearest 5),
 *              'per_started_week' (answer 11: the weekly anchor × started weeks)
 *   defaultQuantity  the quantity a new row starts at
 */

const PLATFORM_LABELS = Object.freeze({ pulse: 'The Pulse', pulse_private: 'Private Pulse account', playroom: 'The PlayRoom' });
const PLATFORMS = Object.freeze(Object.keys(PLATFORM_LABELS));
// How a phrase names an account other than the public one ("1 Pulse video on a private Pulse account").
const PLATFORM_ON = Object.freeze({ pulse: 'on The Pulse', pulse_private: 'on a private Pulse account', playroom: 'on The PlayRoom' });
const ACCOUNTS = Object.freeze(['pulse', 'pulse_private', 'playroom']);

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 365;

const DELIVERABLE_FORMATS = Object.freeze({
  pulse_video: {
    label: 'Pulse video', noun: ['Pulse video', 'Pulse videos'], platforms: ACCOUNTS,
    unit: 'piece', anchor: 'pulse_video', pricing: 'per_unit', defaultQuantity: 1,
  },
  pulse_post: {
    label: 'Pulse post', noun: ['Pulse post', 'Pulse posts'], platforms: ACCOUNTS,
    unit: 'piece', anchor: 'pulse_post', pricing: 'per_unit', defaultQuantity: 1,
  },
  grwm_video: {
    label: 'GRWM video', noun: ['GRWM Pulse video', 'GRWM Pulse videos'], platforms: ACCOUNTS,
    unit: 'piece', anchor: 'grwm_video', pricing: 'per_unit', defaultQuantity: 1,
  },
  pulse_stories: {
    label: 'Pulse stories', noun: ['Pulse story', 'Pulse stories'], platforms: ACCOUNTS,
    unit: 'slide', anchor: 'pulse_stories_3', pricing: 'per_slide_of_3', defaultQuantity: 3,
  },
  carousel_post: {
    label: 'Pulse carousel', noun: ['Pulse carousel', 'Pulse carousels'], platforms: ACCOUNTS,
    unit: 'piece', anchor: 'carousel_post', pricing: 'per_unit', defaultQuantity: 1,
  },
  go_live: {
    label: 'Pulse live', noun: ['Pulse live', 'Pulse lives'], platforms: ACCOUNTS,
    unit: 'piece', anchor: 'go_live', pricing: 'per_unit', defaultQuantity: 1,
  },
  link_in_bio: {
    label: 'Profile link', noun: ['day', 'days'], platforms: ACCOUNTS,
    unit: 'day', anchor: 'link_in_bio_week', pricing: 'per_started_week', defaultQuantity: 7,
  },
  try_on_haul: {
    label: 'Try-on/haul video', noun: ['try-on/haul video', 'try-on/haul videos'], platforms: ACCOUNTS,
    unit: 'piece', anchor: 'try_on_haul', pricing: 'per_unit', defaultQuantity: 1,
  },
  ugc: {
    label: 'Content for the brand (UGC)', noun: ['UGC piece for the brand', 'UGC pieces for the brand'], platforms: [],
    unit: 'piece', anchor: 'ugc', pricing: 'per_unit', defaultQuantity: 1,
  },
  other: {
    label: 'Other', noun: ['other deliverable', 'other deliverables'], platforms: ACCOUNTS,
    unit: 'piece', anchor: null, pricing: 'per_unit', defaultQuantity: 1,
  },
});

const DELIVERABLE_TYPES = Object.freeze(Object.keys(DELIVERABLE_FORMATS));

// The pre-D15 keys and what they are now (migrations
// 20261001160000-add-deliverable-formats.js, 20261018130000-pulse-deliverables.js).
const LEGACY_TYPE_MAP = Object.freeze({
  reel: { deliverable_type: 'pulse_video', platform: 'pulse', quantity: 1, label: 'Reel' },
  story_set_3: { deliverable_type: 'pulse_stories', platform: 'pulse', quantity: 3, label: 'Story Set (3)' },
  post: { deliverable_type: 'pulse_post', platform: 'pulse', quantity: 1, label: 'Post' },
  photo_set: { deliverable_type: 'carousel_post', platform: 'pulse', quantity: 1, label: 'Photo Set' },
});

function formatOf(type) {
  return Object.prototype.hasOwnProperty.call(DELIVERABLE_FORMATS, type || '') ? DELIVERABLE_FORMATS[type] : null;
}

function quantityOf(d) {
  const n = Math.trunc(Number(d?.quantity));
  if (Number.isFinite(n) && n >= QUANTITY_MIN) return n;
  return formatOf(d?.deliverable_type)?.defaultQuantity || 1;
}

/** The account a row is on: its own, else the format's default, else null. */
function platformOf(d) {
  const f = formatOf(d?.deliverable_type);
  if (d?.platform && PLATFORM_LABELS[d.platform]) return d.platform;
  return f && f.platforms.length ? f.platforms[0] : null;
}

/**
 * The Terms label of a row: the format's label, with its quantity when it is
 * more than one ("Pulse stories (×3)"), or its days ("Profile link
 * (7 days)"). null for an untyped row.
 */
function deliverableTypeLabel(d) {
  const f = formatOf(d?.deliverable_type);
  if (!f) return null;
  const n = quantityOf(d);
  if (f.unit === 'day') return `${f.label} (${n} ${n === 1 ? 'day' : 'days'})`;
  return n > 1 ? `${f.label} (×${n})` : f.label;
}

/**
 * The natural phrase for a row ("1 Pulse video", "3 Pulse stories on a
 * private Pulse account", "Profile link (7 days)"), used by lists, tasks and
 * the invitation; an account other than the public one is named. null for an
 * untyped row.
 */
function deliverablePhrase(d) {
  const f = formatOf(d?.deliverable_type);
  if (!f) return null;
  const n = quantityOf(d);
  const platform = platformOf(d);
  const on = platform && platform !== f.platforms[0] ? ` ${PLATFORM_ON[platform]}` : '';
  if (f.unit === 'day') return `Profile link${on} (${n} ${n === 1 ? 'day' : 'days'})`;
  return `${n} ${n === 1 ? f.noun[0] : f.noun[1]}${on}`;
}
/** Rounded to the nearest 5, halves up (answer 9). */
function roundTo5(x) {
  return Math.floor(x / 5 + 0.5) * 5;
}

/**
 * The anchored price of a row at a tier from the rate card, before
 * premiums, or null when the format has no anchor or the card has no
 * amount there. Platform never changes it (answer 12).
 */
function formatAnchorPrice(d, tier, card) {
  const f = formatOf(d?.deliverable_type);
  if (!f || !f.anchor) return null;
  const anchor = card?.anchors?.[f.anchor]?.[tier];
  if (anchor == null) return null;
  const n = quantityOf(d);
  if (f.pricing === 'per_slide_of_3') return roundTo5((Number(anchor) * n) / 3);
  if (f.pricing === 'per_started_week') return Number(anchor) * Math.ceil(n / 7);
  return Number(anchor) * n;
}

module.exports = {
  PLATFORM_LABELS,
  PLATFORMS,
  PLATFORM_ON,
  QUANTITY_MIN,
  QUANTITY_MAX,
  DELIVERABLE_FORMATS,
  DELIVERABLE_TYPES,
  LEGACY_TYPE_MAP,
  formatOf,
  quantityOf,
  platformOf,
  deliverableTypeLabel,
  deliverablePhrase,
  roundTo5,
  formatAnchorPrice,
};
