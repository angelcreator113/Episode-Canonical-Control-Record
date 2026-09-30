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
 * This file is the source of truth; frontend/src/constants/deliverableTypes.json
 * mirrors it (pinned by tests/unit/services/deliverableTypeMirror.test.js).
 *
 * Each format:
 *   label      the Terms label ("Instagram Stories")
 *   noun       [singular, plural] for the natural phrase ("3 Instagram Stories")
 *   platforms  the platforms it can go on; the first is the default; [] = none
 *   platformInPhrase  the platform is named in the phrase ("1 TikTok GRWM")
 *   unit       what the quantity counts: 'piece', 'slide' or 'day'
 *   anchor     the deal_rate_anchors component that prices it, or null
 *   pricing    'per_unit' (anchor × quantity), 'per_slide_of_3' (answer 10:
 *              the 3-slide anchor ÷ 3 × N, rounded to the nearest 5),
 *              'per_started_week' (answer 11: the weekly anchor × started weeks)
 *   defaultQuantity  the quantity a new row starts at
 */

const PLATFORM_LABELS = Object.freeze({ instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' });
const PLATFORMS = Object.freeze(Object.keys(PLATFORM_LABELS));

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 365;

const DELIVERABLE_FORMATS = Object.freeze({
  instagram_reel: {
    label: 'Instagram Reel', noun: ['Instagram Reel', 'Instagram Reels'], platforms: ['instagram'],
    platformInPhrase: false, unit: 'piece', anchor: 'reel', pricing: 'per_unit', defaultQuantity: 1,
  },
  instagram_post: {
    label: 'Instagram post', noun: ['Instagram post', 'Instagram posts'], platforms: ['instagram'],
    platformInPhrase: false, unit: 'piece', anchor: 'instagram_post', pricing: 'per_unit', defaultQuantity: 1,
  },
  tiktok_video: {
    label: 'TikTok video', noun: ['TikTok video', 'TikTok videos'], platforms: ['tiktok'],
    platformInPhrase: false, unit: 'piece', anchor: 'tiktok_video', pricing: 'per_unit', defaultQuantity: 1,
  },
  grwm_video: {
    label: 'GRWM video', noun: ['GRWM', 'GRWMs'], platforms: ['tiktok', 'instagram', 'youtube'],
    platformInPhrase: true, unit: 'piece', anchor: 'grwm_video', pricing: 'per_unit', defaultQuantity: 1,
  },
  instagram_stories: {
    label: 'Instagram Stories', noun: ['Instagram Story', 'Instagram Stories'], platforms: ['instagram'],
    platformInPhrase: false, unit: 'slide', anchor: 'stories_3', pricing: 'per_slide_of_3', defaultQuantity: 3,
  },
  carousel_post: {
    label: 'Carousel post', noun: ['carousel post', 'carousel posts'], platforms: ['instagram', 'tiktok'],
    platformInPhrase: true, unit: 'piece', anchor: 'carousel_post', pricing: 'per_unit', defaultQuantity: 1,
  },
  go_live: {
    label: 'Go Live', noun: ['Live', 'Lives'], platforms: ['instagram', 'tiktok', 'youtube'],
    platformInPhrase: true, unit: 'piece', anchor: 'go_live', pricing: 'per_unit', defaultQuantity: 1,
  },
  link_in_bio: {
    label: 'Link in bio', noun: ['day', 'days'], platforms: ['instagram', 'tiktok'],
    platformInPhrase: false, unit: 'day', anchor: 'link_in_bio_week', pricing: 'per_started_week', defaultQuantity: 7,
  },
  try_on_haul: {
    label: 'Try-on/haul video', noun: ['try-on/haul video', 'try-on/haul videos'], platforms: ['tiktok', 'instagram', 'youtube'],
    platformInPhrase: true, unit: 'piece', anchor: 'try_on_haul', pricing: 'per_unit', defaultQuantity: 1,
  },
  ugc: {
    label: 'Content for the brand (UGC)', noun: ['UGC piece for the brand', 'UGC pieces for the brand'], platforms: [],
    platformInPhrase: false, unit: 'piece', anchor: 'ugc', pricing: 'per_unit', defaultQuantity: 1,
  },
  other: {
    label: 'Other', noun: ['other deliverable', 'other deliverables'], platforms: ['instagram', 'tiktok', 'youtube'],
    platformInPhrase: false, unit: 'piece', anchor: null, pricing: 'per_unit', defaultQuantity: 1,
  },
});

const DELIVERABLE_TYPES = Object.freeze(Object.keys(DELIVERABLE_FORMATS));

// The pre-D15 keys and what they became (migration
// 20261001160000-add-deliverable-formats.js).
const LEGACY_TYPE_MAP = Object.freeze({
  reel: { deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, label: 'Reel' },
  story_set_3: { deliverable_type: 'instagram_stories', platform: 'instagram', quantity: 3, label: 'Story Set (3)' },
  post: { deliverable_type: 'instagram_post', platform: 'instagram', quantity: 1, label: 'Post' },
  photo_set: { deliverable_type: 'carousel_post', platform: 'instagram', quantity: 1, label: 'Photo Set' },
});

function formatOf(type) {
  return Object.prototype.hasOwnProperty.call(DELIVERABLE_FORMATS, type || '') ? DELIVERABLE_FORMATS[type] : null;
}

function quantityOf(d) {
  const n = Math.trunc(Number(d?.quantity));
  if (Number.isFinite(n) && n >= QUANTITY_MIN) return n;
  return formatOf(d?.deliverable_type)?.defaultQuantity || 1;
}

/** The platform a row is on: its own, else the format's only platform, else null. */
function platformOf(d) {
  const f = formatOf(d?.deliverable_type);
  if (d?.platform && PLATFORM_LABELS[d.platform]) return d.platform;
  return f && f.platforms.length === 1 ? f.platforms[0] : null;
}

/**
 * The Terms label of a row: the format's label, with its quantity when it is
 * more than one ("Instagram Stories (×3)"), or its days ("Link in bio
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
 * The natural phrase for a row ("1 TikTok GRWM", "3 Instagram Stories",
 * "Link in bio (7 days)"), used by lists, tasks and the invitation. null for
 * an untyped row.
 */
function deliverablePhrase(d) {
  const f = formatOf(d?.deliverable_type);
  if (!f) return null;
  const n = quantityOf(d);
  const platform = platformOf(d);
  if (f.unit === 'day') {
    const on = platform && f.platforms.length > 1 ? ` on ${PLATFORM_LABELS[platform]}` : '';
    return `Link in bio${on} (${n} ${n === 1 ? 'day' : 'days'})`;
  }
  const noun = n === 1 ? f.noun[0] : f.noun[1];
  const named = f.platformInPhrase && platform ? `${PLATFORM_LABELS[platform]} ${noun}` : noun;
  return `${n} ${named}`;
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
