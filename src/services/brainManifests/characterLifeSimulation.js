'use strict';

/**
 * Character Life Simulation Brain Manifest (Brain Update;
 * docs/BRAIN_OWNERSHIP.md). The 'character_life_simulation' page content
 * (defaults inside CharacterLifeSimulation.jsx).
 */
const { makeManifest } = require('./makeManifest');

module.exports = makeManifest({
  SOURCE: 'character_life_simulation',
  LABEL: 'Character Life Simulation',
  PAGE_CONTENT: 'character_life_simulation',
  SOURCE_DOCUMENT: 'character-life-simulation-v1.0',
  DOMAINS: [
    { key: 'CAREER_STAGES', kind: 'career-stage', label: 'Career Stage', id: 'name' },
    { key: 'CAREER_PATHS', kind: 'career-path', label: 'Career Path', id: 'industry' },
    { key: 'ROMANTIC_TYPES', kind: 'romantic-type', label: 'Romantic Type', id: 'type' },
    { key: 'FAMILY_ROLES', kind: 'family-role', label: 'Family Role', id: 'role' },
    { key: 'FRIEND_GROUPS', kind: 'friend-group', label: 'Friend Group', id: 'type' },
    { key: 'MILESTONES', kind: 'milestone', label: 'Life Milestone', id: 'milestone' },
    { key: 'RIVALRIES', kind: 'rivalry', label: 'Rivalry', id: 'type' },
    { key: 'MENTORSHIP_CHAINS', kind: 'mentorship-generation', label: 'Mentorship Generation', id: 'gen' },
    { key: 'MIGRATIONS', kind: 'migration', label: 'Migration Pattern', id: 'pattern' },
    { key: 'PERSONA_GAPS', kind: 'persona-gap', label: 'Persona Gap', id: 'gap' },
    { key: 'GENERATIONAL_MOMENTS', kind: 'generational-moment', label: 'Generational Moment', id: 'moment' },
  ],
});
