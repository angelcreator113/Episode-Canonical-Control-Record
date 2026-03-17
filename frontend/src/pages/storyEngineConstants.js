export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const PHASE_COLORS = {
  establishment: '#9a7d1e',
  pressure:      '#c0392b',
  crisis:        '#b91c1c',
  integration:   '#0d9668',
};

export const PHASE_LABELS = {
  establishment: 'Establishment',
  pressure:      'Pressure',
  crisis:        'Crisis',
  integration:   'Integration',
};

export const TYPE_ICONS = {
  internal:   '◎',
  collision:  '⊕',
  wrong_win:  '◇',
  eval_scene: '📊',
};

export const WORLD_LABELS = {
  'book-1': 'Book 1 World',
  'lalaverse': 'LalaVerse',
};

export const WORLD_SHORT = { 'book-1': 'B1', lalaverse: 'LV' };

export const ARC_SHORT_LABELS = {
  establishment: 'Estab.',
  pressure: 'Press.',
  crisis: 'Crisis',
  integration: 'Integ.',
};

export const getReadingTime = (wordCount) => {
  if (!wordCount) return null;
  const mins = Math.ceil(wordCount / 250);
  return mins < 1 ? '< 1 min' : `${mins} min read`;
};
