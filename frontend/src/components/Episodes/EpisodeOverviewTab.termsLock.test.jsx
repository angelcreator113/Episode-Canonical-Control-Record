/**
 * The episode overview says so when the server refuses to unlink an event
 * whose terms are locked (docs/EVENT_EPISODE_FLOW.md §8(x) D4, Task #2230).
 * The failure used to go only to the console.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeEvents: vi.fn() }));
vi.mock('../episode/SceneSuggestionReview', () => ({ default: () => null }));
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => null }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab from './EpisodeOverviewTab';

const LOCKED = 'This event started Episode 1 "Gala Night", so its terms are locked: its episode link can\'t change now.';

const renderTab = () => render(
  <MemoryRouter>
    <EpisodeOverviewTab episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala Night' }} show={{ id: 'show-1' }} onUpdate={() => {}} />
  </MemoryRouter>
);

describe('EpisodeOverviewTab and the terms lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(getEpisodeEvents).mockResolvedValue({
      events: [{ id: 'ev-1', name: 'The Gala', used_in_episode_id: 'ep-1', link: { anchor: true, stamped: true } }],
    });
  });

  test('a refused unlink is shown in the server\'s words and the event stays linked', async () => {
    vi.mocked(api.put).mockRejectedValue(Object.assign(new Error('Request failed with status code 409'), {
      response: { status: 409, data: { success: false, code: 'EVENT_TERMS_LOCKED', error: LOCKED } },
    }));

    renderTab();
    fireEvent.click(await screen.findByTitle('Unlink event from this episode'));

    expect((await screen.findByRole('alert')).textContent).toBe(`Could not unlink the event: ${LOCKED}`);
    expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1', { used_in_episode_id: null });
    expect(screen.getByText('The Gala')).toBeTruthy();
  });

  test('a successful unlink shows no error', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });

    renderTab();
    fireEvent.click(await screen.findByTitle('Unlink event from this episode'));

    await vi.waitFor(() => expect(screen.queryByText('The Gala')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
