// Shared sample data for the Home tests (not a test file itself).
export const SHOW = { id: 'show-1', name: 'Styling Adventures with Lala', episodeCount: 6, description: 'Same girl, different city.', coverImageUrl: 'https://img/cover.jpg' };
export const EPS = [
  { id: 'ep-6', show_id: 'show-1', season_number: 2, episode_number: 6, title: 'The Fashion Studio Experiment', status: 'in_build', updated_at: '2026-10-22T10:00:00Z' },
  { id: 'ep-5', show_id: 'show-1', season_number: 2, episode_number: 5, title: 'Rooftop Brunch', status: 'published', updated_at: '2026-10-23T10:00:00Z' },
  { id: 'ep-x', show_id: 'show-2', season_number: 1, episode_number: 1, title: 'Other show', status: 'draft', updated_at: '2026-10-23T11:00:00Z' },
];
export const EVENTS = [
  { id: 'ev-used', name: 'Old Gala', status: 'used', used_in_episode_id: 'ep-5', event_date: '2026-10-01' },
  { id: 'ev-2', name: 'The Honey Table', status: 'draft', event_date: '2026-10-25', venue_name: 'Maison Miel', event_type: 'invite', dress_code: 'Soft glam' },
  { id: 'ev-3', name: 'Later Thing', status: 'draft', event_date: '2026-11-20' },
];
export const POSTS = [
  { id: 'p1', content_text: 'Quiet', poster_handle: 'a', likes: 10, posted_at: '2026-10-22T00:00:00Z' },
  { id: 'p2', content_text: 'Which bag?', poster_handle: 'stylepoll', likes: 15200, posted_at: '2026-10-21T00:00:00Z' },
  { id: 'p3', content_text: 'New hair', poster_handle: 'lalaverse', likes: 12400, posted_at: '2026-10-22T00:00:00Z' },
];
export const UPDATE = {
  since_yesterday: { went_live: { total: 4 }, scheduled: { total: 6 }, new_characters: { total: 1 } },
  cost: { spent_usd: 7.42, budget_usd: 10, left_usd: 2.58, share: 0.742, image_spent_usd: 0.8, image_budget_usd: 3, alerts: [], features: [{ feature: 'pulse_drafts', usd: 2.2, calls: 40 }, { feature: 'script_writer', usd: 3.1, calls: 14 }] },
  waiting: [
    { key: 'drafts', label: 'Pulse drafts', total: 2, items: [{ id: 'd1', handle: 'lalaverse', text: 'Check new DMs' }] },
    { key: 'findings', label: 'Findings to fix', total: 1, read_only: true, items: [{ id: 'c3', character_id: 'c3', name: 'JustAWoman', open: 2 }] },
  ],
};
export const LOOKS = [{ key: 'abcdefghijkl', title: 'Episode 5: Rooftop Brunch', image: { url: 'https://img/look.jpg', alt: 'The look' } }];
export const REG = { registries: [{ characters: [{ id: 'c1', character_key: 'lala', display_name: 'Lala', portrait_url: 'https://img/lala.jpg' }, { id: 'c2', display_name: 'Sable' }] }] };

export const BOOKS = [
  { id: 'b1', title: 'Before Lala', chapter_count: 14, line_count: 1820, approved_count: 1210, pending_count: 312 },
  { id: 'b2', title: 'Book Two', chapter_count: 3, line_count: 200, approved_count: 50, pending_count: 120 },
];
export const MONEY = { success: true, totals: { lifetime_income: 18450, lifetime_expenses: 12900, net: 5550, current_balance: 6050 }, burn_rate_per_episode: 400, runway_episodes: 15 };

/** api.get answers by URL; `over` replaces one answer (a value, or an Error to reject). */
export function answerFor(over = {}) {
  const table = [
    ['/api/v1/shows', { data: [SHOW] }],
    ['/api/v1/episodes?', { data: EPS }],
    ['/world/show-1/events', { events: EVENTS }],
    ['/api/v1/feed-posts', { data: POSTS }],
    ['/characters/lala/state', { state: { coins: 1250, reputation: 6, brand_trust: 4 } }],
    ['/api/v1/daily-update', UPDATE],
    ['/api/v1/public/looks', { looks: LOOKS }],
    ['character-registry/registries', REG],
    ['storyteller/books', { books: BOOKS }],
    ['/financial-summary', MONEY],
  ];
  return async (url) => {
    const hit = table.find(([k]) => (k === '/api/v1/shows' ? url === k : url.includes(k)));
    const key = hit?.[0];
    const value = key in over ? over[key] : hit?.[1];
    if (value instanceof Error) throw value;
    return { data: value ?? {} };
  };
}
