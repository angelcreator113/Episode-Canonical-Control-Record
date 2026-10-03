'use strict';

/**
 * Social Systems Brain Manifest (Evoni, 2026-10-03, Brain Update step 1;
 * docs/BRAIN_OWNERSHIP.md). Says what on the Social Systems page the rest
 * of Prime Studios needs, and turns it into Brain cards, one per source
 * item, each with a stable source_key.
 *
 * The page's data is the 'influencer_systems' page content (usePageData;
 * defaults in frontend/src/data/influencerData.js, overrides in
 * page_content), which both SocialSystems and InfluencerSystems edit.
 *
 * Brain domains: social archetypes, relationship types, economy streams,
 * fashion and beauty trend stages, momentum waves, influence forces,
 * legacy signals. Never pushed: icon, color, display numbering, and any
 * other non-text field (UI and editor state are not page data at all).
 *
 * Pure; no I/O (makeManifest).
 */

const { makeManifest } = require('./makeManifest');

// Each domain: the page_content key, the item kind for its key and title,
// the field naming the item, and labels for the fields that carry meaning.
// Fields not listed here are still carried, under a label made from the key.
const DOMAINS = [
  { key: 'ARCHETYPES', kind: 'archetype', label: 'Social Archetype', id: 'name',
    fields: { content: 'Content', audience: 'Audience effect', narrative: 'Narrative use' } },
  { key: 'RELATIONSHIP_TYPES', kind: 'relationship', label: 'Relationship Type', id: 'type',
    fields: { looksLike: 'Looks like', creates: 'Creates', breaks: 'Breaks when', storyBreaks: 'Story when it breaks' } },
  { key: 'ECONOMY_STREAMS', kind: 'economy', label: 'Economy Stream', id: 'stream',
    fields: { what: 'What it is', who: 'Who uses it', narrative: 'Narrative use' } },
  { key: 'FASHION_TREND_STAGES', kind: 'fashion-trend-stage', label: 'Fashion Trend Stage', id: 'name',
    fields: { stage: 'Stage', who: 'Who', feed: 'On the Feed', story: 'Story' } },
  { key: 'BEAUTY_TREND_STAGES', kind: 'beauty-trend-stage', label: 'Beauty Trend Stage', id: 'name',
    fields: { stage: 'Stage', where: 'Where', story: 'Story' } },
  { key: 'MOMENTUM_WAVES', kind: 'momentum-wave', label: 'Momentum Wave', id: 'event',
    fields: { feedEffect: 'Feed effect', duration: 'Duration', permanent: 'What it changes permanently' } },
  { key: 'INFLUENCE_FORCES', kind: 'influence-force', label: 'Influence Force', id: 'force',
    fields: { definition: 'Definition', built: 'Built by', destroys: 'Destroyed by' } },
  { key: 'LEGACY_SIGNALS', kind: 'legacy-signal', label: 'Legacy Signal', id: 'signal',
    fields: { looksLike: 'Looks like', story: 'Story' } },
];

module.exports = makeManifest({
  SOURCE: 'social_systems',
  LABEL: 'Social Systems',
  PAGE_CONTENT: 'influencer_systems',
  SOURCE_DOCUMENT: 'influencer-systems-v1.0',
  DOMAINS,
});
