/**
 * The episode tabs find their event through GET /api/v1/episodes/:id/events
 * (Task #1906), never by scanning the show's whole event list for
 * used_in_episode_id. Covers the Production Checklist and Assets tab; the
 * Wardrobe tab is covered in pages/EpisodeDetail.wardrobe.test.jsx.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./EpisodeTodoList', () => ({ default: () => null }));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';
import EpisodeAssetsTab from './EpisodeAssetsTab';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Episode One' };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1/events') {
      return { data: { success: true, anchor_event_id: 'ev-1', events: [{ id: 'ev-1', name: 'Gala', link: { anchor: true, stamped: false } }] } };
    }
    return { data: {} };
  });
});

describe('episode event readers (Task #1906)', () => {
  test('Production Checklist reads the episode\'s event from /episodes/:id/events', async () => {
    render(<MemoryRouter><EpisodeProductionChecklist episode={EPISODE} showId="show-1" /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/events'));
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/world/show-1/events');
  });

  test('Assets tab reads the episode\'s event from /episodes/:id/events', async () => {
    render(<MemoryRouter><EpisodeAssetsTab episode={EPISODE} show={{ id: 'show-1' }} /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/events'));
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/world/show-1/events');
  });
});
