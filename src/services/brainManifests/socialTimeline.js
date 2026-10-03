'use strict';

/**
 * Social Timeline Brain Manifest (Brain Update; docs/BRAIN_OWNERSHIP.md).
 * The 'social_timeline' page content (defaults inside SocialTimeline.jsx).
 */
const { makeManifest } = require('./makeManifest');

module.exports = makeManifest({
  SOURCE: 'social_timeline',
  LABEL: 'Social Timeline',
  PAGE_CONTENT: 'social_timeline',
  SOURCE_DOCUMENT: 'social-timeline-v1.0',
  DOMAINS: [
    { key: 'ENGINE_CORE_RULE', kind: 'core-rule', label: 'Feed Engine Core Rule', whole: true },
    { key: 'TIMELINE_LAYERS', kind: 'timeline-layer', label: 'Timeline Layer', id: 'name' },
    { key: 'VIRAL_STAGES', kind: 'viral-stage', label: 'Viral Stage', id: 'name' },
    { key: 'ENGAGEMENT_SIGNALS', kind: 'engagement-signal', label: 'Engagement Signal', id: 'type' },
    { key: 'DRAMA_TRIGGERS', kind: 'drama-trigger', label: 'Drama Trigger', id: 'trigger' },
    { key: 'CULTURAL_OVERRIDES', kind: 'cultural-override', label: 'Cultural Override', id: 'event' },
    { key: 'TREND_STEPS', kind: 'trend-step', label: 'Trend Step', name: (i) => (i.step == null ? '' : `Step ${i.step}`) },
    { key: 'MOMENTUM_ACTIONS', kind: 'momentum-action', label: 'Momentum Action', id: 'action' },
    { key: 'INFLUENCE_CLUSTERS', kind: 'influence-cluster', label: 'Influence Cluster', id: 'cluster' },
    { key: 'SHOCK_EVENTS', kind: 'shock-event', label: 'Shock Event', id: 'event' },
    { key: 'CULTURAL_MEMORY', kind: 'memory-lifespan', label: 'Memory Lifespan', id: 'type' },
    { key: 'CROSS_INDUSTRY', kind: 'cross-industry', label: 'Cross-Industry Influence', id: 'origin' },
    { key: 'ENGINE_QUESTIONS', kind: 'engine-questions', label: 'Feed Engine Questions', whole: true },
  ],
});
