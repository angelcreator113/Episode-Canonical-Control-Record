'use strict';

/**
 * Cultural Memory Brain Manifest (Brain Update; docs/BRAIN_OWNERSHIP.md).
 * The 'cultural_memory' page content, edited and synced on Culture &
 * Events (defaults: frontend/src/data/memoryData.js). The older
 * CulturalMemory page edits the same record with its own, different
 * defaults, so it does not sync.
 */
const { makeManifest } = require('./makeManifest');

module.exports = makeManifest({
  SOURCE: 'cultural_memory',
  LABEL: 'Cultural Memory',
  PAGE_CONTENT: 'cultural_memory',
  SOURCE_DOCUMENT: 'cultural-memory-v1.0',
  DOMAINS: [
    { key: 'MEMORY_TYPES', kind: 'memory-type', label: 'Memory Type', id: 'type' },
    { key: 'STRENGTH_LEVELS', kind: 'memory-strength', label: 'Memory Strength', id: 'name' },
    { key: 'ARCHIVES', kind: 'archive', label: 'Archive', id: 'name' },
    { key: 'ANNIVERSARIES', kind: 'anniversary', label: 'Anniversary', id: 'type' },
    { key: 'NOSTALGIA_WAVES', kind: 'nostalgia-wave', label: 'Nostalgia Wave', id: 'type' },
    { key: 'LEGEND_PATHS', kind: 'legend-path', label: 'Legend Path', id: 'path' },
    { key: 'FEUD_STAGES', kind: 'feud-stage', label: 'Feud Stage', id: 'stage' },
    { key: 'CAPSULE_TYPES', kind: 'capsule-type', label: 'Time Capsule', id: 'type' },
    { key: 'REFERENCE_TYPES', kind: 'reference-type', label: 'Reference Type', id: 'type' },
    { key: 'RANKING_METRICS', kind: 'ranking-metric', label: 'Ranking Metric', id: 'metric' },
  ],
});
