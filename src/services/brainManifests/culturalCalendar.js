'use strict';

/**
 * Cultural Calendar Brain Manifest (Brain Update; docs/BRAIN_OWNERSHIP.md).
 * The 'cultural_calendar' page content, edited and synced on Culture &
 * Events (defaults: frontend/src/data/calendarData.js). The older
 * CulturalCalendar page edits the same record with its own, different
 * defaults, so it does not sync.
 */
const { makeManifest } = require('./makeManifest');

module.exports = makeManifest({
  SOURCE: 'cultural_calendar',
  LABEL: 'Cultural Calendar',
  PAGE_CONTENT: 'cultural_calendar',
  SOURCE_DOCUMENT: 'cultural-system-v2.0',
  DOMAINS: [
    { key: 'CELEBRITY_HIERARCHY', kind: 'celebrity-tier', label: 'Celebrity Tier', id: 'name' },
    { key: 'FASHION_TIERS', kind: 'fashion-tier', label: 'Fashion Tier', id: 'name' },
    { key: 'BEAUTY_TIERS', kind: 'beauty-tier', label: 'Beauty Tier', id: 'name' },
    { key: 'ALGORITHM_FORCES', kind: 'algorithm-force', label: 'Algorithm Force', id: 'name' },
    { key: 'DRAMA_MECHANICS', kind: 'drama-mechanic', label: 'Drama Mechanic', id: 'type' },
    { key: 'AWARD_SHOWS', kind: 'award-show', label: 'Award Show', id: 'name' },
    { key: 'GOSSIP_MEDIA', kind: 'gossip-outlet', label: 'Gossip Outlet', id: 'name' },
    { key: 'FAMOUS_CHARACTERS', kind: 'famous-character', label: 'Famous Character', id: 'title' },
    { key: 'BIRTHDAY_TEMPLATES', kind: 'birthday-template', label: 'Birthday Template', id: 'name' },
  ],
});
