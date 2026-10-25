/**
 * Design tokens & constants — RelationshipEngine
 * Prime Studios · LalaVerse
 */

import { findLala } from '../../lib/theCast';

export const API = '/api/v1';

/* ─── tokens ─────────────────────────────────────────────────────────── */
// The house palette (--lala-* in styles/design-tokens.css): parchment, gold,
// ink; Lora for headings, DM Mono for labels. Rose, steel and orchid stay as
// tones that carry meaning (romance and pressure, step/chosen and support,
// secrets and mirrors), darkened so text in them reads at 4.5:1 or more
// (2026-10-24 layout audit; the old #d4789a / #7ab3d4 / #a889c8 read ~2.9:1).
export const T = {
  rose:       '#A8336C',
  roseDeep:   '#8F1F55',
  roseFog:    '#FDEAF3',
  steel:      '#3D6E8F',
  steelFog:   '#EAF2F7',
  orchid:     '#6A4C93',
  orchidDeep: '#4A3B7A',
  orchidFog:  '#ECE6F7',
  gold:       '#B8962E',
  goldText:   '#7A6314',
  goldFog:    '#FDF8EE',
  ink:        '#2C2C2C',
  inkMid:     '#4A4538',
  inkDim:     '#6B6557',
  inkFaint:   '#A09889',
  white:      '#ffffff',
  paper:      '#FAF7F0',
  rule:       '#E8E0D0',
  ruleLight:  '#F4EFE4',
  shadow:     '0 1px 3px rgba(44,44,44,.06), 0 4px 16px rgba(44,44,44,.08)',
  shadowUp:   '0 -1px 3px rgba(44,44,44,.04), 0 8px 32px rgba(44,44,44,.12)',
  r:          '3px',
  rMd:        '8px',
  rLg:        '14px',
  font:       "'DM Mono', 'SF Mono', Monaco, Consolas, monospace",
  fontBody:   "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontMono:   "'DM Mono', 'SF Mono', Monaco, Consolas, monospace",
  fontProse:  "'Lora', Georgia, 'Times New Roman', serif",
};

/* ─── role palette ───────────────────────────────────────────────────── */
export const ROLE = {
  protagonist: { color: T.steel,    bg: T.steelFog  },
  pressure:    { color: T.rose,     bg: T.roseFog   },
  mirror:      { color: T.orchid,   bg: T.orchidFog },
  support:     { color: '#2F7A5A',  bg: '#EAF5EE'   },
  shadow:      { color: '#8A6630',  bg: '#F7F0E8'   },
  special:     { color: T.goldText, bg: T.goldFog   },
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

/*
 * The Tree's bands (2026-10-23): everyone here lives in Lala's world, so the
 * bands are Lala and then each person's role, not the old real-world /
 * LalaVerse / "Series 2" layers (Lala's stored role 'special' put her in
 * "Series 2").
 */
export const BANDS = [
  { key: 'lala',     label: 'Lala',               color: T.rose,    roles: [] },
  { key: 'support',  label: 'Friends & support',  color: '#2F7A5A', roles: ['support', 'protagonist'] },
  { key: 'pressure', label: 'Pressure & rivals',  color: T.steel,   roles: ['pressure'] },
  { key: 'mirror',   label: 'Mirrors & shadows',  color: T.orchid,  roles: null }, // everyone else
];
export function bandOf(c, lalaId) {
  if (c && lalaId && String(c.id) === String(lalaId)) return 'lala';
  const b = BANDS.find(x => x.roles && x.roles.includes(c?.role_type));
  return b ? b.key : 'mirror';
}

export const EDGE_COLOR = {
  romantic:      T.rose,
  familial:      '#2F7A5A',
  mirror:        T.orchid,
  support:       '#2F7A5A',
  shadow:        '#94a3b8',
  transactional: T.gold,
  creation:      T.orchid,
  pressure:      T.rose,
};

export const NODE_R = { special: 36, protagonist: 36, pressure: 28, mirror: 24, support: 20, shadow: 20 };

export const CONN_MODES = ['IRL', 'Online Only', 'Passing', 'Professional', 'One-sided'];
export const STATUSES   = ['Active', 'Past', 'One-sided', 'Complicated'];
export const TENSIONS   = ['calm', 'simmering', 'volatile', 'fractured', 'healing'];
// worldStudio writes knows_protagonist and independent too.
export const LALA_CONN  = [
  { v: 'none',              l: 'No connection' },
  { v: 'knows_lala',        l: 'Knows Lala directly' },
  { v: 'knows_protagonist', l: 'Knows the protagonist' },
  { v: 'through_justwoman', l: 'Through JustAWoman (unaware)' },
  { v: 'interacts_content', l: 'Interacts with content' },
  { v: 'independent',       l: 'Independent of Lala' },
  { v: 'unaware',           l: 'Completely unaware' },
];
// A love interest is romantic (episode story records write love_interest).
export const REL_PRESETS = [
  { label: 'Love interest', type: 'love_interest', romantic: true },
  ...['Sister', 'Brother', 'Mother', 'Father', 'Husband', 'Wife',
    'Best Friend', 'Friend', 'Collaborator', 'Rival', 'Mentor', 'Manager', 'Stylist', 'Fan',
  ].map(label => ({ label, type: label.toLowerCase(), romantic: ['Husband', 'Wife'].includes(label) })),
];

/*
 * A company's types (Evoni, 2026-10-24: "how should we handle relationships
 * between brands?"): a registry character marked as a company (the server's
 * services/companyCharacters; a row's character_a_company / _b_company, a
 * cast member's company) is never a romance or family, so every type picker
 * offers only these when either side is one; two companies, only partner or
 * rival brand. The server's list is services/relationshipTypes COMPANY_TYPES.
 */
export const COMPANY_PRESETS = [
  { label: 'Client or partner', type: 'client_partner', romantic: false },
  { label: 'Sponsor', type: 'sponsor', romantic: false },
  { label: 'Works for / represents', type: 'represents', romantic: false },
  { label: 'Press or critic', type: 'press', romantic: false },
  { label: 'Rival brand', type: 'rival_brand', romantic: false },
  { label: 'Fan', type: 'fan', romantic: false },
];
export const BRAND_PAIR_PRESETS = COMPANY_PRESETS.filter(p => ['client_partner', 'rival_brand'].includes(p.type));
const COMPANY_LABEL = Object.fromEntries(COMPANY_PRESETS.map(p => [p.type, p.label]));
/** A side's company ({ id, slug, name, kind }) or null: the row's, else the loaded person's. */
export const sideCompany = (r, side, charById = {}) => {
  if (!r) return null;
  const own = side === 'a' ? r.character_a_company : r.character_b_company;
  if (own) return own;
  const c = charById[side === 'a' ? r.character_id_a : r.character_id_b];
  return c?.company || null;
};
/** { a, b, any, both } for a relationship row: which side is a company. */
export const pairCompanies = (r, charById = {}) => {
  const a = sideCompany(r, 'a', charById);
  const b = sideCompany(r, 'b', charById);
  return { a, b, any: !!(a || b), both: !!(a && b) };
};
/** The type picker's list for a pair: company types when either side is a company. */
export const presetsFor = ({ any = false, both = false } = {}) => (both ? BRAND_PAIR_PRESETS : any ? COMPANY_PRESETS : REL_PRESETS);

/*
 * Where two people are on their timeline (relationship_events.relationship_stage),
 * in story order; the episode story record writes these.
 */
export const STAGES = ['strangers', 'acquaintances', 'flirting', 'friends', 'close_friends', 'lovers', 'partners', 'exes', 'enemies'];
export const STAGE_TONE = {
  strangers: 'is-cool', acquaintances: 'is-cool', flirting: 'is-warm', friends: 'is-calm', close_friends: 'is-calm',
  lovers: 'is-hot', partners: 'is-hot', exes: 'is-sore', enemies: 'is-sore',
};

/* ─── helpers ────────────────────────────────────────────────────────── */
// One name per person everywhere: the chosen name, then the display name
// (often the feed handle). The server names relationship rows the same way.
export const cname    = c => (c && (c.selected_name || c.display_name || c.character_key)) || '?';
/** A relationship side's name: the loaded person's, else the row's. */
export const sideName = (r, side, charById = {}) => {
  const id = side === 'a' ? r.character_id_a : r.character_id_b;
  const c = charById[id];
  if (c) return cname(c);
  return (side === 'a' ? (r.character_a_name || r.character_a_selected) : (r.character_b_name || r.character_b_selected)) || '?';
};
/** Words for a stored label: "love_interest" reads "Love interest". */
export const humanize = v => {
  const w = String(v || '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
};
export const typeLabel  = r => {
  const t = typeof r === 'string' ? r : r?.relationship_type;
  return COMPANY_LABEL[t] || humanize(t) || 'Connected';
};
export const stageLabel = s => humanize(s);
export const isLoveInterest = r => !!r && (r.is_romantic === true || r.relationship_type === 'love_interest');
/*
 * One rule for romance and family, here and on the character page
 * (lib/characterConnections): romance is never family. A spouse or partner
 * (family_role wife, husband, partner, ex-…) is romance, shown with its
 * role; family is everyone else with a family role, a blood tie or a kind.
 */
const PARTNER_ROLE = /^(ex-)?(wife|husband|spouse|partner|fianc[ée]e?|girlfriend|boyfriend)$/;
export const isPartnerRole = role => PARTNER_ROLE.test(String(role || '').trim().toLowerCase());
export const isRomance = r => isLoveInterest(r) || (!!r && isPartnerRole(r.family_role));
export const isFamily = r => !!r && !isRomance(r) && !!(r.family_role || r.is_blood_relation || r.family_kind);
export const initials   = s => s.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
/** Is this person Lala: the page's Lala id when known, else her key or name (lib/theCast). */
export const isLalaChar = (c, lalaId = null) => !!c && (lalaId ? String(c.id) === String(lalaId) : !!findLala([c]));
/**
 * A person's role in words, the same everywhere on the page: Lala is the
 * Protagonist whatever her stored role ('special'; Task #3199), the rest
 * their role type.
 */
export const roleLabel = (c, lalaId = null) => (isLalaChar(c, lalaId) ? 'Protagonist' : (humanize(c?.role_type) || '—'));
