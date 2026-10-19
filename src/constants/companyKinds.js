'use strict';

/**
 * Brands and companies (Evoni, 2026-10-18: "yes start the brand and company
 * profile pages"). Every company in Lala's world is a row of
 * lalaverse_brands with a `kind` (migration 20261019100000); deals point at
 * one by opportunities.company_id.
 *
 *   COMPANY_KINDS       kind → its label
 *   SECTIONS_BY_KIND    the profile's tabs for each kind, in order
 *   SECTION_LABELS      a tab's label, by kind where it reads differently
 *   PRESS_OUTLETS       the four publications the press characters run
 *                       (routes/press.js PRESS_CHARACTERS), seeded as
 *                       'outlet' companies by the migration
 *   normalizeName(name) how two names are compared: trimmed, one space,
 *                       lower case ("  The  Column " = "the column")
 */

const COMPANY_KINDS = Object.freeze({
  brand: 'Fashion brand',
  outlet: 'Magazine or press outlet',
  agency: 'Agency',
  venue: 'Venue',
});

const SECTIONS_BY_KIND = Object.freeze({
  brand: ['identity', 'people', 'pulse', 'business', 'wardrobe', 'press', 'relationships'],
  outlet: ['identity', 'people', 'pulse', 'business', 'press'],
  agency: ['identity', 'people', 'pulse', 'business'],
  venue: ['identity', 'business', 'press'],
});

const SECTION_LABELS = Object.freeze({
  identity: 'Identity',
  people: 'People',
  pulse: 'On The Pulse',
  business: 'Business',
  wardrobe: 'Wardrobe',
  press: { brand: 'Press & events', outlet: 'What it published', venue: 'Events held here' },
  relationships: 'Relationships',
});

const sectionLabel = (key, kind) => {
  const l = SECTION_LABELS[key];
  return typeof l === 'string' ? l : (l[kind] || l.brand);
};

// The press characters' publications, as routes/press.js has them; a unit
// test keeps the two in step.
const PRESS_OUTLETS = Object.freeze([
  { slug: 'the_real_rate', name: 'The Real Rate', publisher_key: 'reyna_voss', publisher: 'Reyna Voss', tagline: 'What the beauty economy actually pays.', category: 'business' },
  { slug: 'undressed', name: 'Undressed', publisher_key: 'solene_beaumont', publisher: 'Solène Beaumont', tagline: 'On beauty, identity, and the decision to take up space.', category: 'beauty' },
  { slug: 'first_look', name: 'First Look', publisher_key: 'taye_okafor', publisher: 'Taye Okafor', tagline: 'Who\'s worth watching. Before everyone knows it.', category: 'culture' },
  { slug: 'the_cost_of_wanting_more', name: 'The Cost of Wanting More', publisher_key: 'asha_brennan', publisher: 'Asha Brennan', tagline: 'On ambition, visibility, and the interior life of women who build.', category: 'lifestyle' },
]);

const normalizeName = (name) => String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();

module.exports = { COMPANY_KINDS, SECTIONS_BY_KIND, SECTION_LABELS, sectionLabel, PRESS_OUTLETS, normalizeName };
