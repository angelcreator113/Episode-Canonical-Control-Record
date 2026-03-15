/**
 * Character Constants — Shared across CharacterGenerator & CharacterRegistryPage
 *
 * Single source of truth for role colors, labels, icons, momentum states,
 * world labels, dossier tabs, archetypes, and other character-domain constants.
 *
 * CRITICAL: Both CharacterGenerator.jsx and CharacterRegistryPage.jsx import
 *           from here. If you change a value, both pages update.
 */

// ─── Role System ──────────────────────────────────────────────────────────────

/** Color for each narrative role (used in badges, borders, cards) */
export const ROLE_COLORS = {
  protagonist: '#c9a84c',
  pressure:    '#d46070',
  mirror:      '#7b8de0',
  support:     '#5dab62',
  shadow:      '#9b4dca',
  special:     '#5ec0b8',
};

/** Human-readable labels */
export const ROLE_LABELS = {
  protagonist: 'Protagonist',
  pressure:    'Antagonist',
  mirror:      'Mirror',
  support:     'Supporting',
  shadow:      'Shadow',
  special:     'Special',
};

/** Unicode glyphs for compact role badges */
export const ROLE_ICONS = {
  protagonist: '♛',
  pressure:    '⊗',
  mirror:      '◎',
  support:     '◉',
  shadow:      '◆',
  special:     '✦',
};

/** Dropdown / select options array */
export const ROLE_OPTIONS = [
  { value: 'protagonist', label: 'Protagonist' },
  { value: 'pressure',    label: 'Antagonist' },
  { value: 'mirror',      label: 'Mirror' },
  { value: 'support',     label: 'Supporting' },
  { value: 'shadow',      label: 'Shadow' },
  { value: 'special',     label: 'Special' },
];

// ─── Momentum ─────────────────────────────────────────────────────────────────

/** Full momentum descriptor (symbol, color, label) */
export const MOMENTUM = {
  rising:  { symbol: '↑', color: '#3d8e42', label: 'Rising' },
  steady:  { symbol: '→', color: '#9a8c9e', label: 'Steady' },
  falling: { symbol: '↓', color: '#c43a2a', label: 'Falling' },
  dormant: { symbol: '·', color: '#6b5c6e', label: 'Dormant' },
};

/** Convenience flat map: key → color (used in Generator's ecosystem panel) */
export const MOMENTUM_COLORS = Object.fromEntries(
  Object.entries(MOMENTUM).map(([k, v]) => [k, v.color])
);

// ─── World / Book ─────────────────────────────────────────────────────────────

export const WORLD_LABELS = {
  book1:     'Book 1',
  lalaverse: 'LalaVerse',
};

// ─── Registry Dossier Tabs ────────────────────────────────────────────────────

export const DOSSIER_TABS = [
  { key: 'overview',      label: 'Overview' },
  { key: 'demographics',  label: 'Demographics' },
  { key: 'living',        label: '✦ Living State' },
  { key: 'arc',           label: 'Arc Timeline' },
  { key: 'threads',       label: 'Plot Threads' },
  { key: 'psychology',    label: 'Psychology' },
  { key: 'aesthetic',     label: 'Aesthetic DNA' },
  { key: 'career',        label: 'Career' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'story',         label: 'Story Presence' },
  { key: 'voice',         label: 'Voice' },
  { key: 'death',         label: 'Death Tracking' },
  { key: 'dilemma',       label: 'Dilemma' },
  { key: 'depth',         label: '🧬 Depth Engine' },
  { key: 'ai',            label: '✦ AI Writer' },
];

// ─── Character Metadata ───────────────────────────────────────────────────────

export const CANON_TIERS = ['Core Canon', 'Licensed', 'Minor'];

export const ARCHETYPES = [
  'Strategist', 'Dreamer', 'Performer', 'Guardian', 'Rebel',
  'Visionary', 'Healer', 'Trickster', 'Sage', 'Creator',
];

export const GLAM_ENERGIES = ['Minimal', 'Maximal', 'Editorial'];
export const STORY_STATUSES = ['Active', 'Evolving', 'Archived'];
