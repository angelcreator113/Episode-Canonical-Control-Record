'use strict';

/**
 * Social Personality Brain Manifest (Brain Update; docs/BRAIN_OWNERSHIP.md).
 * The 'social_personality' page content (defaults inside
 * SocialPersonality.jsx), including JustAWoman's social profile.
 */
const { makeManifest } = require('./makeManifest');

module.exports = makeManifest({
  SOURCE: 'social_personality',
  LABEL: 'Social Personality',
  PAGE_CONTENT: 'social_personality',
  SOURCE_DOCUMENT: 'social-personality-v1.0',
  DOMAINS: [
    { key: 'PERSONALITY_TRAITS', kind: 'trait', label: 'Personality Trait', id: 'trait' },
    { key: 'POSTING_ARCHETYPES', kind: 'posting-archetype', label: 'Posting Archetype', id: 'archetype' },
    { key: 'MOTIVATION_TYPES', kind: 'motivation', label: 'Motivation Type', id: 'type' },
    { key: 'RELATIONSHIP_DYNAMICS', kind: 'relationship-dynamic', label: 'Relationship Dynamic', id: 'type' },
    { key: 'EMOTIONAL_REACTIONS', kind: 'emotional-reaction', label: 'Emotional Reaction', id: 'type' },
    { key: 'REPUTATION_TYPES', kind: 'reputation', label: 'Reputation Type', id: 'type' },
    { key: 'GROWTH_FORCES', kind: 'growth-force', label: 'Growth Force', id: 'force' },
    { key: 'DAMAGE_EVENTS', kind: 'damage-event', label: 'Damage Event', id: 'event' },
    { key: 'STORY_ARCS', kind: 'story-arc', label: 'Story Arc', id: 'arc' },
    { key: 'ALGO_INTERACTIONS', kind: 'algorithm-interaction', label: 'Algorithm Interaction', id: 'traits' },
    { key: 'JAW_PROFILE', kind: 'justawoman-profile', label: "JustAWoman's Social Profile", whole: true },
  ],
});
