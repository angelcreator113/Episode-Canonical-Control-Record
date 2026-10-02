/**
 * B3 (Evoni, 2026-10-02): the checklist's "Venue image generated" checks for
 * an actual base image on the event's scene set. It was ticked whenever the
 * event had a scene set, image or not.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({
  getEpisodeAnchorEvent: vi.fn(async () => ({ id: 'ev-1', name: 'Gala', venue_name: 'The Glasshouse', scene_set_id: 'set-1' })),
}));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';

let setImage;
const renderChecklist = () => render(
  <MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1' }} showId="show-1" /></MemoryRouter>,
);
const ticked = async () => {
  const label = await screen.findByText('Venue image generated');
  return label.style.textDecoration === 'line-through';
};

describe('EpisodeProductionChecklist: "Venue image generated" (B3)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/scene-sets/set-1') return { data: { success: true, data: { id: 'set-1', base_still_url: setImage } } };
      return { data: {} };
    });
  });

  test('not ticked when the event\'s scene set has no base image', async () => {
    setImage = null;
    renderChecklist();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1'));
    await waitFor(async () => expect(await ticked()).toBe(false));
  });

  test('ticked when it has one', async () => {
    setImage = 'https://cdn.example/glasshouse.jpg';
    renderChecklist();
    await waitFor(async () => expect(await ticked()).toBe(true));
  });
});
