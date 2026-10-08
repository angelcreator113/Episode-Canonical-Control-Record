/**
 * The seeded franchise laws and the pages whose Brain Update cards share
 * their documents name the five DREAM cities, never the legacy ones
 * (wiring map fix-list item 20; migration
 * 20261008110000-franchise-laws-dream-city-names). A ratchet: a legacy
 * name written back into one of these files fails here.
 */
const fs = require('fs');
const path = require('path');
const { RENAMES } = require('../../../src/migrations/20261008110000-franchise-laws-dream-city-names');
const { DREAM_CITIES } = require('../../../src/utils/lalaHome');

const ROOT = path.join(__dirname, '../../..');
const FILES = [
  'src/seeders/20260312200000-world-infrastructure-franchise-laws.js',
  'src/seeders/20260312300000-social-timeline-franchise-laws.js',
  'src/seeders/20260312500000-character-life-simulation-franchise-laws.js',
  'src/seeders/20260312600000-cultural-memory-franchise-laws.js',
  'frontend/src/pages/CharacterLifeSimulation.jsx',
  'frontend/src/pages/SocialTimeline.jsx',
];

describe('franchise laws name the DREAM cities', () => {
  test.each(FILES)('%s names no legacy city, school or house', (file) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const found = RENAMES.map(([from]) => from).filter((from) => text.includes(from));
    expect(found).toEqual([]);
  });

  test('every city the migration renames to is a DREAM city', () => {
    const cityTargets = RENAMES.map(([, to]) => to).filter((to) => !/Academy|Institute|House/.test(to));
    expect(cityTargets.sort()).toEqual([...DREAM_CITIES].sort());
  });
});
