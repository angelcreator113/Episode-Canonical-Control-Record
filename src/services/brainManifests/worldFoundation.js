'use strict';

/**
 * World Foundation Brain Manifest (Brain Update; docs/BRAIN_OWNERSHIP.md).
 * The 'world_infrastructure' page content as World Foundation edits it:
 * the DREAM cities, universities, corporations and world layers (defaults:
 * frontend/src/data/dreamCities.js). The older WorldInfrastructure page
 * edits the same record with other keys (CITIES, LEGENDARY_GROUPS) and
 * older city names, so it does not sync. Map positions are not page
 * content and never reach this manifest.
 */
const { makeManifest } = require('./makeManifest');

module.exports = makeManifest({
  SOURCE: 'world_foundation',
  LABEL: 'World Foundation',
  PAGE_CONTENT: 'world_infrastructure',
  SOURCE_DOCUMENT: 'world-infrastructure-v1.0',
  PRESENTATION: ['key', 'letter', 'lightColor'],
  DOMAINS: [
    { key: 'DREAM_CITIES', kind: 'city', label: 'DREAM City', id: 'name' },
    { key: 'UNIVERSITIES', kind: 'university', label: 'University', id: 'name' },
    { key: 'CORPORATIONS', kind: 'corporation', label: 'Corporation', id: 'name' },
    { key: 'WORLD_LAYERS', kind: 'world-layer', label: 'World Layer', id: 'layer' },
  ],
});
