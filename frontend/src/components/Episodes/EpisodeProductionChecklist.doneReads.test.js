/**
 * What the checklist crosses out (Evoni, 2026-10-09: "production checklist
 * doesnt have everything crossed out that it should"): four checks read the
 * wrong thing and stayed open after the work was done.
 *   - Outfit picked: the outfit locked on the Wardrobe tab, not only the
 *     event's planned pieces.
 *   - Scene sets assigned: also the sets the scene plan or the event uses.
 *   - Social media checklist: the episode's social tasks too.
 *   - Show Brain: the route answers { entries }; data.data was never there.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => ({ id: 'ev-1', scene_set_id: null, outfit_pieces: [] })) }));

import api from '../../services/api';
import { loadProductionChecks } from './EpisodeProductionChecklist';

let responses;
beforeEach(() => {
  vi.mocked(api.get).mockReset();
  responses = {};
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url in responses) return { data: responses[url] };
    return { data: {} };
  });
});

const episode = { id: 'ep-1', show_id: 'show-1', title: 'Episode 1' };

describe('the checks read what the work actually writes', () => {
  test('a locked outfit, a planned scene set, social tasks and Show Brain entries all count', async () => {
    responses['/api/v1/wardrobe/outfit/ep-1'] = { items: [{ id: 'w1', name: 'Silk slip dress' }] };
    responses['/api/v1/episodes/ep-1/scene-sets'] = { data: [] };
    responses['/api/v1/episode-brief/ep-1/plan'] = { data: [{ beat_number: 1, scene_set_id: 'set-1' }], coverage: { complete: false, text: '1 of 14' } };
    responses['/api/v1/episodes/ep-1/todo/social'] = { social_tasks: [{ label: 'Post a GRWM reel' }] };
    responses['/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1'] = { entries: [{ id: 'law-1' }], count: 1 };
    const { checks } = await loadProductionChecks(episode, 'show-1');
    expect(checks.outfit_picked).toBe(true);
    expect(checks.scene_sets).toBe(true);
    expect(checks.social_checklist).toBe(true);
    expect(checks.show_brain).toBe(true);
  });

  test('none of it done: all four stay open', async () => {
    responses['/api/v1/wardrobe/outfit/ep-1'] = { items: [] };
    responses['/api/v1/episodes/ep-1/scene-sets'] = { data: [] };
    responses['/api/v1/episode-brief/ep-1/plan'] = { data: [{ beat_number: 1, scene_set_id: null }], coverage: { complete: false, text: '1 of 14' } };
    responses['/api/v1/episodes/ep-1/todo/social'] = { social_tasks: [] };
    responses['/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1'] = { entries: [], count: 0 };
    const { checks } = await loadProductionChecks(episode, 'show-1');
    expect(checks.outfit_picked).toBe(false);
    expect(checks.scene_sets).toBe(false);
    expect(checks.social_checklist).toBe(false);
    expect(checks.show_brain).toBe(false);
  });

  test('a title made after the page loaded counts, the overlay or the framed card (Evoni, 2026-10-09)', async () => {
    responses['/api/v1/episodes/ep-1'] = { data: { id: 'ep-1', title_overlay_asset_id: null, title_card_asset_id: 'card-1' } };
    expect((await loadProductionChecks(episode, 'show-1')).checks.title_overlay).toBe(true);
    responses['/api/v1/episodes/ep-1'] = { data: { id: 'ep-1', title_overlay_asset_id: 'ov-1' } };
    expect((await loadProductionChecks(episode, 'show-1')).checks.title_overlay).toBe(true);
    responses['/api/v1/episodes/ep-1'] = { data: { id: 'ep-1' } };
    expect((await loadProductionChecks(episode, 'show-1')).checks.title_overlay).toBe(false);
  });
});
