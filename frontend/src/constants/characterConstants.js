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

export const DOSSIER_TAB_GROUPS = [
  { group: null, tabs: [
    { key: 'overview', label: 'Overview', icon: '◈' },
  ]},
  { group: 'Identity', tabs: [
    { key: 'demographics', label: 'Demographics', icon: '▤' },
    { key: 'psychology',   label: 'Psychology',   icon: '◉' },
    { key: 'aesthetic',    label: 'Aesthetic',     icon: '◆' },
    { key: 'voice',        label: 'Voice',         icon: '¶' },
  ]},
  { group: 'Narrative', tabs: [
    { key: 'living',    label: 'Living State',  icon: '✦' },
    { key: 'arc',       label: 'Arc Timeline',  icon: '↗' },
    { key: 'threads',   label: 'Plot Threads',  icon: '⊟' },
    { key: 'dilemma',   label: 'Dilemma',       icon: '⚖' },
  ]},
  { group: 'World', tabs: [
    { key: 'career',        label: 'Career',        icon: '▰' },
    { key: 'relationships', label: 'Relationships', icon: '⇄' },
    { key: 'story',         label: 'Story',         icon: '📖' },
    { key: 'death',         label: 'Death',         icon: '†' },
  ]},
  { group: 'AI', tabs: [
    { key: 'depth', label: 'Depth Engine', icon: '🧬' },
    { key: 'ai',    label: 'AI Writer',   icon: '✦' },
  ]},
];
export const DOSSIER_TABS = DOSSIER_TAB_GROUPS.flatMap(g => g.tabs);

// ── Dossier Completeness Tracking ────────────────────────────────────────────
export const DOSSIER_SECTIONS = {
  core:         { label: 'Core',         fields: ['display_name','description','core_belief','role_type','pressure_type'] },
  demographics: { label: 'Demographics', fields: ['gender','age','ethnicity','hometown','current_city','class_origin'] },
  psychology:   { label: 'Psychology',   fields: ['core_desire','core_fear','core_wound','mask_persona','truth_persona','emotional_baseline'] },
  aesthetic:    { label: 'Aesthetic',    jsonb: 'aesthetic_dna', fields: ['era_aesthetic','color_palette','signature_silhouette','glam_energy'] },
  voice:        { label: 'Voice',        jsonb: 'voice_signature', fields: ['speech_pattern','vocabulary_tone','catchphrases','internal_monologue_style'] },
  career:       { label: 'Career',       jsonb: 'career_status', fields: ['profession','career_goal','public_recognition'] },
  relationships:{ label: 'Relationships',jsonb: 'relationships_map', fields: ['allies','rivals','love_interests','mentors'] },
  story:        { label: 'Story',        jsonb: 'story_presence', fields: ['appears_in_books','current_story_status'] },
};

export function getDossierCompleteness(char) {
  if (!char) return { pct: 0, sections: {}, gaps: [] };
  let filled = 0, total = 0;
  const sections = {};
  const gaps = [];
  for (const [key, sec] of Object.entries(DOSSIER_SECTIONS)) {
    const src = sec.jsonb ? (() => { try { return typeof char[sec.jsonb] === 'string' ? JSON.parse(char[sec.jsonb]) : (char[sec.jsonb] || {}); } catch { return {}; } })() : char;
    const secFilled = sec.fields.filter(f => {
      const val = src?.[f];
      if (val === null || val === undefined) return false;
      if (typeof val === 'string' && !val.trim()) return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }).length;
    const missing = sec.fields.filter(f => {
      const val = src?.[f];
      return !val || (typeof val === 'string' && !val.trim()) || (Array.isArray(val) && val.length === 0);
    });
    sections[key] = { filled: secFilled, total: sec.fields.length, label: sec.label, missing };
    if (missing.length > 0) gaps.push({ section: sec.label, tab: key, missing });
    filled += secFilled;
    total += sec.fields.length;
  }
  return { pct: total ? Math.round((filled / total) * 100) : 0, sections, gaps };
}

// ─── Character Metadata ───────────────────────────────────────────────────────

export const CANON_TIERS = ['Core Canon', 'Licensed', 'Minor'];

export const ARCHETYPES = [
  'Strategist', 'Dreamer', 'Performer', 'Guardian', 'Rebel',
  'Visionary', 'Healer', 'Trickster', 'Sage', 'Creator',
];

export const GLAM_ENERGIES = ['Minimal', 'Maximal', 'Editorial'];
export const STORY_STATUSES = ['Active', 'Evolving', 'Archived'];
