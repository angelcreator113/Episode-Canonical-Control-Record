/**
 * Event Package — Style: choose Lala's look before Start Episode
 * (Task #2376).
 *
 * The Style area showed "Not chosen" with no way to choose: the closet
 * picker was only reachable from the Events card's ⋯ menu (#1649). An
 * unused event now opens EventOutfitPicker from the Package, which saves
 * through PUT /world/:showId/events/:eventId/outfit (world_events.outfit_pieces).
 * A used event stays read-only.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const OPTIONS_URL = `${EVENT_URL}/wardrobe-options`;
const OUTFIT_URL = `${EVENT_URL}/outfit`;

const EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Velour Awards Night',
  event_type: 'invite',
  prestige: 6,
  category: 'arts_entertainment',
  format: 'gala',
  event_date: '2026-11-09',
  host_brand: 'Velour',
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: {} },
  outfit_pieces: [],
};

const CLOSET = [
  { id: 'w-1', name: 'Gold Slip Dress', clothing_category: 'dress', tier: 'luxury', price: 0 },
  { id: 'w-2', name: 'Strappy Heels', clothing_category: 'shoes', tier: 'mid', price: 0 },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

let currentEvent;
function mockPackage({ event, usedInEpisode = null, termsLockedBy = null }) {
  currentEvent = event;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: {
        success: true, event: currentEvent, sourceProfile: null, startedFromProfile: null,
        sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode, termsLockedBy,
      } };
    }
    if (url === OPTIONS_URL) return { data: { success: true, items: CLOSET } };
    if (url === OUTFIT_URL) return { data: { success: true, pieces: currentEvent.outfit_pieces || [], score: null } };
    return { data: { success: true, deliverables: [], locked: false } };
  });
}

describe('EventPackagePage — Style: choosing the outfit', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('an unused event: Choose outfit opens the closet and saves the pieces', async () => {
    mockPackage({ event: { ...EVENT, used_in_episode_id: null } });
    const pieces = [{ id: 'w-1', name: 'Gold Slip Dress' }, { id: 'w-2', name: 'Strappy Heels' }];
    vi.mocked(api.put).mockImplementation(async (url, body) => {
      expect(url).toBe(OUTFIT_URL);
      expect(body).toEqual({ wardrobe_ids: ['w-1', 'w-2'] });
      currentEvent = { ...currentEvent, outfit_pieces: pieces };
      return { data: { success: true, pieces, score: { match_score: 82, narrative_mood: 'confidence' } } };
    });
    renderPage();

    const style = await screen.findByTestId('style-section');
    expect(within(style).getByTestId('style-outfit-summary').textContent).toBe('Not chosen');
    fireEvent.click(within(style).getByTestId('style-choose-outfit'));

    const picker = await screen.findByTestId('outfit-picker');
    fireEvent.click(await within(picker).findByText('Gold Slip Dress'));
    fireEvent.click(within(picker).getByText('Strappy Heels'));
    fireEvent.click(within(picker).getByTestId('outfit-picker-save'));

    await waitFor(() => expect(screen.queryByTestId('outfit-picker')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('style-outfit-summary').textContent).toBe('2 pieces chosen'));
    expect(screen.getByTestId('style-section').textContent).toContain('Gold Slip Dress');
    expect(screen.getByTestId('style-choose-outfit').textContent).toContain('Change outfit');
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  test('a used event: the outfit shows, with no picker', async () => {
    const lockEp = { id: 'ep-7', episode_number: 7, title: 'Velour' };
    mockPackage({
      event: { ...EVENT, used_in_episode_id: 'ep-7', status: 'used', outfit_pieces: [{ id: 'w-1', name: 'Gold Slip Dress' }] },
      usedInEpisode: lockEp,
      termsLockedBy: lockEp,
    });
    renderPage();

    const style = await screen.findByTestId('style-section');
    expect(within(style).getByTestId('style-outfit-summary').textContent).toBe('1 piece chosen');
    expect(within(style).queryByTestId('style-choose-outfit')).toBeNull();
  });
});
