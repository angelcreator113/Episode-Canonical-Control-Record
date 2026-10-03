'use strict';

/**
 * Character Depth Engine Brain Manifest (Brain Update;
 * docs/BRAIN_OWNERSHIP.md). The 'character_depth_engine' page content
 * (defaults inside CharacterDepthEngine.jsx). Field names here are
 * snake_case ids ('self_narrative'), shown as words.
 */
const { makeManifest } = require('./makeManifest');

module.exports = makeManifest({
  SOURCE: 'character_depth_engine',
  LABEL: 'Character Depth Engine',
  PAGE_CONTENT: 'character_depth_engine',
  SOURCE_DOCUMENT: 'character-depth-engine-v1.0',
  DOMAINS: [
    { key: 'ARCHITECTURE_LAYERS', kind: 'architecture-layer', label: 'Architecture Layer', id: 'layer' },
    { key: 'BODY_FIELDS', kind: 'body-field', label: 'Body Field', id: 'field', humanizeName: true },
    { key: 'MONEY_PATTERNS', kind: 'money-pattern', label: 'Money Pattern', id: 'pattern' },
    { key: 'TIME_ORIENTATIONS', kind: 'time-orientation', label: 'Time Orientation', id: 'orientation' },
    { key: 'LUCK_FIELDS', kind: 'luck-field', label: 'Luck Field', id: 'field', humanizeName: true },
    { key: 'NARRATIVE_FIELDS', kind: 'narrative-field', label: 'Narrative Field', id: 'field', humanizeName: true },
    { key: 'GAP_TYPES', kind: 'gap-type', label: 'Gap Type', id: 'type', humanizeName: true },
    { key: 'BLINDSPOT_CATEGORIES', kind: 'blindspot', label: 'Blind Spot', id: 'cat', humanizeName: true },
    { key: 'CHANGE_TYPES', kind: 'change-capacity', label: 'Change Capacity', id: 'capacity', humanizeName: true },
    { key: 'COSMOLOGY_TYPES', kind: 'cosmology', label: 'Cosmology', id: 'type', humanizeName: true },
    { key: 'FORECLOSED_CATEGORIES', kind: 'foreclosed-categories', label: 'Foreclosed Categories', whole: true },
    { key: 'FORECLOSED_FIELDS', kind: 'foreclosed-field', label: 'Foreclosed Field', id: 'field', humanizeName: true },
    { key: 'JOY_ACCESSIBILITY', kind: 'joy-accessibility', label: 'Joy Accessibility', id: 'level', humanizeName: true },
    { key: 'JOY_FIELDS', kind: 'joy-field', label: 'Joy Field', id: 'field', humanizeName: true },
  ],
});
