/**
 * feedConstants.js — Shared constants for the Feed tab
 */

export const API = '/api/v1/social-profiles';
export const SCHED_API = '/api/v1/feed-scheduler';

// ── Prime Studios Design Tokens ────────────────────────────────────────
export const C = {
  pink:       '#d4789a',
  pinkLight:  '#fce8f0',
  pinkMid:    '#f0b8cc',
  blue:       '#7ab3d4',
  blueLight:  '#e8f3fa',
  lavender:   '#a889c8',
  lavLight:   '#ede6f7',
  ink:        '#1a1625',
  inkMid:     '#4a3f5c',
  inkLight:   '#7a6e8a',
  surface:    '#ffffff',
  surfaceAlt: '#faf8fc',
  border:     '#ede8f5',
  shadow:     '0 2px 16px rgba(168,137,200,0.10)',
  shadowMd:   '0 6px 32px rgba(168,137,200,0.15)',
  radius:     '12px',
  radiusSm:   '8px',
  font:       "'DM Sans', 'Segoe UI', sans-serif",
};

export const PLATFORMS = [
  { value:'instagram', label:'Instagram' },
  { value:'tiktok',   label:'TikTok' },
  { value:'youtube',  label:'YouTube' },
  { value:'twitter',  label:'Twitter / X' },
  { value:'onlyfans', label:'OnlyFans' },
  { value:'twitch',   label:'Twitch' },
  { value:'substack', label:'Substack' },
  { value:'multi',    label:'Multi-Platform' },
];

export const ARCHETYPE_LABELS = {
  polished_curator:  'Polished Curator',
  messy_transparent: 'Messy Transparent',
  soft_life:         'Soft Life',
  explicitly_paid:   'Explicitly Paid',
  overnight_rise:    'Overnight Rise',
  cautionary:        'Cautionary',
  the_peer:          'The Peer',
  the_watcher:       'The Watcher',
  chaos_creator:     'Chaos Creator',
  community_builder: 'Community Builder',
};

export const STATUS_LABELS = {
  draft:'Draft', generated:'Generated', finalized:'Finalized', crossed:'Crossed', archived:'Archived',
};

export const STATUS_COLORS = {
  draft:     { bg:'#f0f0f5',     color:'#6b6a80' },
  generated: { bg:C.blueLight,  color:'#1e4a7a' },
  finalized: { bg:'#e8f5ee',    color:'#2d7a50' },
  crossed:   { bg:C.lavLight,   color:'#5c2d8a' },
  archived:  { bg:'#f0ede6',    color:'#6b6560' },
};

export const FEED_STATE_CONFIG = {
  rising:        { label:'Rising',        color:'#4a8a3c', bg:'#eef7ec' },
  peaking:       { label:'Peaking',       color:'#8a6010', bg:'#fdf8e8' },
  plateauing:    { label:'Plateauing',    color:'#6b6a80', bg:'#f0f0f5' },
  controversial: { label:'Controversial', color:'#8a4410', bg:'#fdf0e8' },
  cancelled:     { label:'Cancelled',     color:'#8a2020', bg:'#fde8e8' },
  gone_dark:     { label:'Gone Dark',     color:'#444',    bg:'#eee' },
  rebuilding:    { label:'Rebuilding',    color:'#1e4a7a', bg:C.blueLight },
  crossed:       { label:'Crossed',       color:'#5c2d8a', bg:C.lavLight },
};

export const LALAVERSE_CITIES = [
  { value:'nova_prime',  label:'Nova Prime', desc:'Fashion & Aspiration' },
  { value:'velour_city', label:'Velour City', desc:'Music & Culture' },
  { value:'the_drift',   label:'The Drift', desc:'Underground & Anti-Algorithm' },
  { value:'solenne',     label:'Solenne', desc:'Luxury & Soft Life' },
  { value:'cascade_row', label:'Cascade Row', desc:'Commerce & Hustle' },
];

export const LALA_RELATIONSHIPS = [
  { value:'mutual_unaware', label:'Mutual Unaware' },
  { value:'one_sided',      label:'Lala watches them' },
  { value:'aware',          label:'Both aware' },
  { value:'direct',         label:'Know each other' },
  { value:'competitive',    label:'Active competition' },
];

export const CAREER_PRESSURES = [
  { value:'ahead',          label:'Ahead of Lala' },
  { value:'level',          label:'Level with Lala' },
  { value:'behind',         label:'Behind Lala' },
  { value:'different_lane', label:'Different lane' },
];

export const PROTAGONISTS = [
  {
    key:'justawoman', label:'Book 1 · JustAWoman', icon:'◈',
    context: {
      name:'JustAWoman',
      description:'A Black woman, mother, wife, content creator in fashion/beauty/lifestyle.',
      wound:'She does everything right and the right room has not found her yet.',
      goal:'To be legendary.', audience:'Besties',
      detail:'She posts for women. Men show up with their wallets and something in her responds.',
    },
  },
  {
    key:'lala', label:'Book 2 · Lala', icon:'✦',
    context: {
      name:'Lala',
      description:'Born from JustAWoman\'s world but building her own. Young, sharp, digitally native.',
      wound:'She inherited her mother\'s ambition but not her patience.',
      goal:'To become something that can\'t be copied.',
      audience:'The generation that learned to perform before they learned to feel',
      detail:'The line between consuming and creating dissolved before she noticed.',
    },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────
export function lalaClass(score) { return score>=7?'high':score>=4?'mid':'low'; }
export function fp(p) { return p?.full_profile||p||{}; }
export function getToken() { return localStorage.getItem('authToken')||localStorage.getItem('token')||sessionStorage.getItem('token'); }
export function authHeaders() { const t=getToken(); return t?{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}:{'Content-Type':'application/json'}; }
