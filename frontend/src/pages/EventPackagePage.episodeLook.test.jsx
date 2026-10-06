/**
 * Lala's Look once the event has started an episode (Evoni, 2026-10-06:
 * "wardrobe pieces are not showing"). After Start Episode the look is chosen
 * in the episode's Wardrobe, so section 4 shows the episode's look
 * (data.episodeLook: locked, chosen but not locked yet, or the event's own),
 * each piece owned or to buy, with Open Wardrobe. Before, it is the event's.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Studio Session', event_type: 'invite', prestige: 4,
  updated_at: '2026-10-06T10:00:00.000Z', canon_consequences: { automation: {} },
};
let payload;

const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
    <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-1/events/ev-1') {
      return { data: { success: true, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, ...payload } };
    }
    return { data: { success: true, deliverables: [], locked: false } };
  });
});

const used = (episodeLook, extra = {}) => ({
  event: { ...EVENT, used_in_episode_id: 'ep-9', ...extra },
  usedInEpisode: { id: 'ep-9', episode_number: 1, title: 'Studio' },
  termsLockedBy: { id: 'ep-9', episode_number: 1, title: 'Studio' },
  episodeLook,
});

describe("Lala's Look after Start Episode", () => {
  test("the look locked in the episode's Wardrobe shows, each piece owned or to buy, with Open Wardrobe", async () => {
    payload = used({ episode_id: 'ep-9', state: 'locked', pieces: [
      { id: 'w1', name: 'Sculpted Linen Dress', is_owned: false, coin_cost: 420 },
      { id: 'w2', name: 'Polished Flats', is_owned: true, coin_cost: 180 },
    ] });
    renderPage();
    const section = await screen.findByTestId('style-section');
    expect(within(section).getByTestId('style-outfit-summary').textContent).toBe('2 pieces locked');
    expect(section.textContent).toContain('Sculpted Linen Dress');
    expect(within(section).getByTestId('look-piece-cost-w1').textContent).toBe('to buy · 420 coins');
    expect(within(section).getByTestId('look-piece-cost-w2').textContent).toBe('owned');
    expect(within(section).getByTestId('look-from').textContent).toContain("Locked in the episode's Wardrobe");
    expect(within(section).getByTestId('look-open-wardrobe').getAttribute('href')).toBe('/episodes/ep-9?tab=wardrobe');
    expect(section.textContent).not.toContain('No outfit yet');
    expect(within(section).queryByTestId('style-choose-outfit')).toBeNull();
  });

  test('pieces chosen but not locked say so', async () => {
    payload = used({ episode_id: 'ep-9', state: 'chosen', pieces: [{ id: 'w1', name: 'Sculpted Linen Dress', is_owned: false, coin_cost: 420 }] });
    renderPage();
    const section = await screen.findByTestId('style-section');
    expect(within(section).getByTestId('style-outfit-summary').textContent).toBe('1 chosen, not locked yet');
    expect(within(section).getByTestId('look-from').textContent).toContain('not locked yet');
  });

  test("nothing chosen anywhere: Not chosen, pointing to the episode's Wardrobe", async () => {
    payload = used({ episode_id: 'ep-9', state: 'none', pieces: [] });
    renderPage();
    const section = await screen.findByTestId('style-section');
    expect(within(section).getByTestId('style-outfit-summary').textContent).toBe('Not chosen');
    expect(section.textContent).toContain("Choose it in the episode's Wardrobe");
    expect(within(section).getByTestId('look-open-wardrobe')).toBeTruthy();
  });

  test('before Start Episode the event\'s own outfit shows, with Change outfit and no Open Wardrobe', async () => {
    payload = { event: { ...EVENT, outfit_pieces: [{ id: 'w1', name: 'Sculpted Linen Dress' }] }, usedInEpisode: null, episodeLook: null };
    renderPage();
    const section = await screen.findByTestId('style-section');
    expect(within(section).getByTestId('style-outfit-summary').textContent).toBe('1 piece chosen');
    expect(within(section).getByTestId('style-choose-outfit').textContent).toContain('Change outfit');
    expect(within(section).queryByTestId('look-open-wardrobe')).toBeNull();
    expect(within(section).queryByTestId('look-piece-cost-w1')).toBeNull();
  });
});
