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
  reinventing:   { label:'Reinventing',   color:'#1e4a7a', bg:C.blueLight },
  gone_dark:     { label:'Gone Dark',     color:'#444',    bg:'#eee' },
  posthumous:    { label:'Posthumous',    color:'#555',    bg:'#e8e8e8' },
};

export const LALAVERSE_CITIES = [
  { value:'dazzle_district',  label:'Dazzle District',  desc:'Fashion & Luxury',           letter: 'D', color: '#d4789a' },
  { value:'radiance_row',     label:'Radiance Row',     desc:'Beauty & Wellness',           letter: 'R', color: '#a889c8' },
  { value:'echo_park',        label:'Echo Park',        desc:'Entertainment & Nightlife',   letter: 'E', color: '#c9a84c' },
  { value:'ascent_tower',     label:'Ascent Tower',     desc:'Tech & Innovation',           letter: 'A', color: '#6bba9a' },
  { value:'maverick_harbor',  label:'Maverick Harbor',  desc:'Creator Economy & Counter-culture', letter: 'M', color: '#7ab3d4' },
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

// ── Enhanced Feed Constants ───────────────────────────────────────────

export const VIRAL_TIERS = {
  nano:  { label: 'Micro-viral', color: '#22c55e', threshold: 500 },
  mid:   { label: 'Going Viral', color: '#f59e0b', threshold: 2000 },
  mega:  { label: 'Viral Moment', color: '#ef4444', threshold: 10000 },
  ultra: { label: 'Cultural Moment', color: '#8b5cf6', threshold: 50000 },
};

export const AUDIENCE_SENTIMENTS = {
  supportive:  { label: 'Supportive', color: '#22c55e', bg: '#f0fdf4' },
  divided:     { label: 'Divided', color: '#f59e0b', bg: '#fffbeb' },
  hostile:     { label: 'Hostile', color: '#ef4444', bg: '#fef2f2' },
  curious:     { label: 'Curious', color: '#6366f1', bg: '#eef2ff' },
  indifferent: { label: 'Indifferent', color: '#9ca3af', bg: '#f9fafb' },
};

export const NARRATIVE_FUNCTIONS = {
  reaction:      { label: 'Reaction', color: '#6366f1' },
  bts:           { label: 'BTS', color: '#B8962E' },
  flex:          { label: 'Flex', color: '#ec4899' },
  shade:         { label: 'Shade', color: '#ef4444' },
  support:       { label: 'Support', color: '#22c55e' },
  comparison:    { label: 'Comparison', color: '#f59e0b' },
  gossip:        { label: 'Gossip', color: '#8b5cf6' },
  brand_content: { label: 'Brand Content', color: '#0ea5e9' },
  callback:      { label: 'Callback', color: '#6b7280' },
};

export const EMOTIONAL_IMPACTS = {
  confidence_boost: { label: 'Confidence Boost', color: '#B8962E' },
  anxiety:          { label: 'Anxiety', color: '#f59e0b' },
  jealousy:         { label: 'Jealousy', color: '#dc2626' },
  validation:       { label: 'Validation', color: '#ec4899' },
  indifference:     { label: 'Indifference', color: '#9ca3af' },
  anger:            { label: 'Anger', color: '#ef4444' },
};

export const ENHANCED_API = '/api/v1/feed-enhanced';

// ── Helpers ────────────────────────────────────────────────────────────
export function lalaClass(score) { return score>=7?'high':score>=4?'mid':'low'; }
export function fp(p) { return p?.full_profile||p||{}; }
export function getToken() { return localStorage.getItem('authToken')||localStorage.getItem('token')||sessionStorage.getItem('token'); }
export function authHeaders() { const t=getToken(); return t?{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}:{'Content-Type':'application/json'}; }
