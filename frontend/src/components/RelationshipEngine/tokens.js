/**
 * Design tokens & constants — RelationshipEngine
 * Prime Studios · LalaVerse
 */

export const API = '/api/v1';

/* ─── tokens ─────────────────────────────────────────────────────────── */
export const T = {
  rose:       '#d4789a',
  roseDeep:   '#b85a7c',
  roseFog:    '#fdf2f6',
  steel:      '#7ab3d4',
  steelFog:   '#eef6fb',
  orchid:     '#a889c8',
  orchidDeep: '#8a66b0',
  orchidFog:  '#f3effa',
  ink:        '#0f0c14',
  inkMid:     '#3d3548',
  inkDim:     '#7a7088',
  inkFaint:   '#b8b0c8',
  white:      '#ffffff',
  paper:      '#faf9fc',
  rule:       '#e8e4f0',
  ruleLight:  '#f0edf8',
  shadow:     '0 1px 3px rgba(15,12,20,.06), 0 4px 16px rgba(15,12,20,.08)',
  shadowUp:   '0 -1px 3px rgba(15,12,20,.04), 0 8px 32px rgba(15,12,20,.12)',
  r:          '3px',
  rMd:        '8px',
  rLg:        '14px',
  font:       "'Syne', 'Helvetica Neue', sans-serif",
  fontBody:   "'DM Sans', 'Segoe UI', sans-serif",
  fontMono:   "'JetBrains Mono', 'Fira Code', monospace",
};

/* ─── role palette ───────────────────────────────────────────────────── */
export const ROLE = {
  protagonist: { color: T.steel,    bg: T.steelFog  },
  pressure:    { color: T.rose,     bg: T.roseFog   },
  mirror:      { color: T.orchid,   bg: T.orchidFog },
  support:     { color: '#6bba9a',  bg: '#edf7f2'   },
  shadow:      { color: '#b89060',  bg: '#f7f0e8'   },
  special:     { color: '#c9a84c',  bg: '#fdf7e6'   },
};
export const roleColor = r => (ROLE[r] || ROLE.shadow).color;
export const roleBg    = r => (ROLE[r] || ROLE.shadow).bg;

export const TENSION = {
  calm:      { color: '#3a7a50', bg: '#eaf5ee', border: '#b0d8be' },
  simmering: { color: '#8a5f10', bg: '#fdf6e3', border: '#e8d090' },
  volatile:  { color: '#a02020', bg: '#fdeaea', border: '#e8a8a8' },
  fractured: { color: '#6a30a0', bg: '#f3eafa', border: '#c8a8e8' },
  healing:   { color: '#1a5080', bg: '#e8f3fa', border: '#a0c8e8' },
};

export const LAYER = {
  'real-world': { label: 'Real World', short: 'RW', color: T.steel  },
  'lalaverse':  { label: 'LalaVerse',  short: 'LV', color: T.orchid },
  'series-2':   { label: 'Series 2',   short: 'S2', color: T.rose   },
};

export const EDGE_COLOR = {
  romantic:      T.rose,
  familial:      '#6bba9a',
  mirror:        T.orchid,
  support:       '#6bba9a',
  shadow:        '#94a3b8',
  transactional: '#c9a84c',
  creation:      T.orchid,
  pressure:      T.rose,
};

export const NODE_R = { special: 36, protagonist: 36, pressure: 28, mirror: 24, support: 20, shadow: 20 };

export const CONN_MODES = ['IRL', 'Online Only', 'Passing', 'Professional', 'One-sided'];
export const STATUSES   = ['Active', 'Past', 'One-sided', 'Complicated'];
export const TENSIONS   = ['calm', 'simmering', 'volatile', 'fractured', 'healing'];
export const LALA_CONN  = [
  { v: 'none',              l: 'No connection' },
  { v: 'knows_lala',        l: 'Knows Lala directly' },
  { v: 'through_justwoman', l: 'Through JustAWoman (unaware)' },
  { v: 'interacts_content', l: 'Interacts with content' },
  { v: 'unaware',           l: 'Completely unaware' },
];
export const REL_PRESETS = [
  'Sister','Brother','Mother','Father','Husband','Wife',
  'Best Friend','Friend','Collaborator','Rival','Mentor','Manager','Stylist','Fan',
];

/* ─── helpers ────────────────────────────────────────────────────────── */
export const cname    = c => c.selected_name || c.display_name || c.character_key || '?';
export const clayer   = c => {
  if (c.universe === 'lalaverse' || c.layer === 'lalaverse') return 'lalaverse';
  if (c.universe === 'series-2'  || c.layer === 'series-2')  return 'series-2';
  return 'real-world';
};
export const initials   = s => s.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
export const compatible = (a, b) => clayer(a) === clayer(b);
