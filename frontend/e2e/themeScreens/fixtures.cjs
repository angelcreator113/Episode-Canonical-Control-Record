/**
 * Fixtures for the theme screenshot pass (audit VISUAL-01/02, batch 4).
 * One show, three events in three states, three episodes, three scene sets
 * in three statuses, a todo list, money, Lala's state. Every response is a
 * "fat envelope": the payload sits under `data` and under the collection
 * key each page reads, so one fixture serves every unwrap in the pages.
 */
const SHOW = '11111111-1111-4111-8111-111111111111';
const EP = ['22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222202', '22222222-2222-4222-8222-222222222203'];
const EV = ['33333333-3333-4333-8333-333333333301', '33333333-3333-4333-8333-333333333302', '33333333-3333-4333-8333-333333333303'];
const SS = ['44444444-4444-4444-8444-444444444401', '44444444-4444-4444-8444-444444444402', '44444444-4444-4444-8444-444444444403'];
const LOC = ['55555555-5555-4555-8555-555555555501', '55555555-5555-4555-8555-555555555502'];
const now = '2026-10-03T12:00:00.000Z';
const svg = (fill, text) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="55%" font-size="48" font-family="sans-serif" text-anchor="middle" fill="#fff">${text}</text></svg>`);

const show = { id: SHOW, showId: SHOW, name: 'Styling Adventures with Lala', showName: 'Styling Adventures with Lala', metadata: {}, episodes: [] };
const locations = [
  { id: LOC[0], name: 'Lala\'s Apartment', city: 'Dream City', type: 'HOME', description: 'Home base' },
  { id: LOC[1], name: 'The Atelier', city: 'Dream City', type: 'VENUE', description: 'A gallery venue' },
];
const events = [
  { id: EV[0], show_id: SHOW, name: 'Gallery Opening Night', event_type: 'gala', host: 'The Atelier', host_brand: 'Atelier', status: 'ready', prestige: 4, cost_coins: 120, is_paid: true, payment_amount: 300, narrative_stakes: 'Lala meets the curator.', dress_code: 'black tie', dress_code_keywords: ['black', 'silk'], deadline_type: 'soft', strictness: 2, career_tier: 2, venue_name: 'The Atelier', venue_location_id: LOC[1], scene_set_id: SS[0], color_palette: ['#2F7F76', '#C06E87'], description: 'A gallery opening.', canon_consequences: [], used_in_episode_id: null, updated_at: now, source_profile_id: null, outfit_pieces: [{ slot: 'dress', label: 'Silk slip dress' }] },
  { id: EV[1], show_id: SHOW, name: 'Brand Breakfast', event_type: 'brand', host: 'Maison Rose', host_brand: 'Maison Rose', status: 'draft', prestige: 2, cost_coins: 0, is_free: true, narrative_stakes: 'A deal on the table.', dress_code: 'smart casual', dress_code_keywords: ['pink'], deadline_type: 'hard', strictness: 1, career_tier: 1, venue_name: 'Rose Cafe', venue_location_id: LOC[1], scene_set_id: null, color_palette: [], description: 'Breakfast with a brand.', canon_consequences: [], used_in_episode_id: null, updated_at: now, outfit_pieces: [] },
  { id: EV[2], show_id: SHOW, name: 'Rooftop Fitting', event_type: 'fitting', host: 'Lala', status: 'used', prestige: 1, cost_coins: 40, is_paid: false, narrative_stakes: 'A quiet moment.', dress_code: 'casual', dress_code_keywords: [], deadline_type: 'soft', strictness: 0, career_tier: 1, venue_name: 'Rooftop', venue_location_id: LOC[0], scene_set_id: SS[1], color_palette: [], description: 'A fitting at home.', canon_consequences: [], used_in_episode_id: EP[2], updated_at: now, outfit_pieces: [] },
];
const episodes = EP.map((id, i) => ({
  id, episodeId: id, show_id: SHOW, showId: SHOW, show, episode_number: i + 1, episodeNumber: i + 1,
  title: ['The Opening', 'Breakfast Deal', 'Rooftop'][i], episodeTitle: ['The Opening', 'Breakfast Deal', 'Rooftop'][i],
  status: ['draft', 'in_production', 'published'][i], evaluation_status: ['accepted', 'pending', 'complete'][i], evaluation_json: null,
  thumbnail_url: svg(['#2F7F76', '#C06E87', '#B8962E'][i], `Ep ${i + 1}`), thumbnailUrl: svg(['#2F7F76', '#C06E87', '#B8962E'][i], `Ep ${i + 1}`),
  wardrobeCount: 3, isFavorite: i === 0, financial_score: 72, script_content: '', event_id: EV[i], world_event_id: EV[i], created_at: now, updated_at: now,
}));
const sceneSets = SS.map((id, i) => ({
  id, show_id: SHOW, show, name: ['Gallery Floor', 'Lala\'s Closet', 'Rooftop Dusk'][i], scene_type: ['EVENT_LOCATION', 'CLOSET', 'HOME_BASE'][i],
  generation_status: ['complete', 'generating', 'pending'][i], base_still_url: i < 2 ? svg(['#2F7F76', '#C06E87'][i], ['Gallery', 'Closet'][i]) : null,
  base_approved: i === 0, location_approved_base: i === 0, cover_angle_id: null, canonical_description: 'A room with light from the left.',
  time_of_day: 'dusk', season: 'autumn', mood_tags: ['warm'], world_location_id: i === 0 ? LOC[1] : null, is_franchise_asset: i === 1,
  visual_language: { color_palette: ['#2F7F76', '#C06E87', '#B8962E'], lighting: 'soft' }, angles: [], episodes: [], events: [], looks: [], updated_at: now,
}));
const lalaState = { success: true, show_id: SHOW, coins: 420, reputation: 3, brand_trust: 2, influence: 4, stress: 3, state: { coins: 420, reputation: 3, brand_trust: 2, influence: 4, stress: 3 }, data: { coins: 420, reputation: 3, brand_trust: 2, influence: 4, stress: 3 } };
const todo = {
  id: 'todo-1', episode_id: EP[0], status: 'generated', asset_url: null,
  tasks: [
    { slot: 'dress', label: 'Silk slip dress', description: 'Midnight, bias cut', required: true, completed: true, included: true },
    { slot: 'shoes', label: 'Strappy heels', description: 'Gold', required: true, completed: false, included: true },
    { slot: 'bag', label: 'Mini clutch', description: 'Optional sparkle', required: false, completed: false, included: true },
    { slot: 'coat', label: 'Wool coat', description: 'Excluded for the season', required: false, completed: false, included: false },
  ],
  completion: { total: 3, completed: 1, all_required_done: false },
  social_tasks: [{ id: 't1', label: 'Post a story from the gallery', description: 'Brand deliverable', task_source: 'brand_deliverable', required: true, completed: false }],
};
const money = { success: true, data: { episode_id: EP[0], total_income: 300, total_cost: 160, net: 140, ledger: [{ id: 'l1', type: 'income', label: 'Appearance fee', amount: 300, status: 'posted' }, { id: 'l2', type: 'cost', label: 'Outfit', amount: 160, status: 'pending' }], items: [] } };
// The overlay reads res.data as one object: state, season and the ranked list.
const suggestionsBody = {
  state: { coins: 420, stress: 3, reputation: 3 }, season: { next_slot: { label: 'Act 2, slot 3', intention: 'raise the stakes', desired_pressure: 'medium' } },
  suggestions: events.slice(0, 2).map((event, i) => ({ event, score: i === 0 ? 42 : -8, affordable: true, reasons: [{ kind: 'boost', text: 'Paid, and Lala needs coins' }, { kind: i === 0 ? 'warn' : 'block', text: i === 0 ? 'Tight deadline' : 'Repeats last episode\'s host' }] })),
};
const suggestions = { success: true, data: suggestionsBody, ...suggestionsBody };

module.exports = { SHOW, EP, EV, SS, show, locations, events, episodes, sceneSets, lalaState, todo, money, suggestions };
