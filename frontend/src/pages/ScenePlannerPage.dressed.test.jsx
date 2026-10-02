/**
 * L10 (Evoni, 2026-10-02, docs/EVENT_EPISODE_FLOW.md §8(hh)): "When an
 * event has a dressed look, its episode's angles at that venue are made
 * from the dressed look instead of the plain approved base." At a set the
 * episode's event has a finished look on (location.look), the Beat Plan's
 * Generate angle and Upload image make the dressed angle; its cost is shown
 * first. A beat shows its dressed angle when there is one.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';

const LOOK = { id: 'look-1', image_url: 'https://x/look.jpg' };
const PLAN = [
  { id: 'p10', beat_number: 10, beat_name: 'Event Travel', scene_set_id: 'set-venue', angle_label: 'DOORWAY', locked: false, sceneSet: { id: 'set-venue', name: 'The Glasshouse', base_still_url: 'https://x/base.jpg' },
    location: { role: 'event', kinds: ['entrance'], look: LOOK, angle: { id: 'ang-door', label: 'DOORWAY', name: 'Entrance', still_image_url: null },
      missing: { reason: 'no_image', kind: 'entrance', kinds: [], label: 'DOORWAY', angle_id: 'ang-door', name: 'Entrance', text: 'Entrance angle has no image' } } },
  { id: 'p11', beat_number: 11, beat_name: 'Event Outcome', scene_set_id: 'set-venue', angle_label: 'WIDE', locked: false, sceneSet: { id: 'set-venue', name: 'The Glasshouse', base_still_url: 'https://x/base.jpg' },
    location: { role: 'event', kinds: ['main_interior'], look: LOOK, missing: null,
      angle: { id: 'ang-wide', label: 'WIDE', name: 'Main hall', still_image_url: 'https://x/wide-dressed.jpg', plain_image_url: 'https://x/wide.jpg', dressed: { id: 'd1', status: 'complete', image_url: 'https://x/wide-dressed.jpg' } } } },
  { id: 'p1', beat_number: 1, beat_name: 'Opening Ritual', scene_set_id: 'set-home', locked: false, sceneSet: { id: 'set-home', name: 'Apartment', base_still_url: 'https://x/home.jpg' },
    location: { role: 'home', kinds: [], angle: null, missing: null } },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('ScenePlannerPage: angles dressed from the event\'s look (L10)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { data: { locations: [], show_id: 'show-1' } } };
      return { data: {} };
    });
  });

  test('a beat shows its dressed angle, tagged "Event look"; other beats show their own image', async () => {
    renderPage();
    await screen.findByTestId('beat-missing-10');
    const images = [...document.querySelectorAll('.scene-planner-card-image img')].map((img) => img.getAttribute('src'));
    expect(images).toEqual(['https://x/look.jpg', 'https://x/wide-dressed.jpg', 'https://x/home.jpg']);
    expect(screen.getByTestId('beat-dressed-tag-11')).toBeTruthy();
    expect(screen.queryByTestId('beat-dressed-tag-10')).toBeNull();
    expect(screen.getByTestId('beat-missing-look-10').textContent).toBe("Made from the event's look.");
  });

  // S8 (Evoni, 2026-10-02; §8(dd)), answer 2: dressed angles are made on the
  // look in the Scene Sets panel; the Beat Plan links there.
  test('S8: a missing dressed angle links to Scene Sets on its angle; nothing is made here', async () => {
    renderPage();
    const link = await screen.findByTestId('beat-open-scene-sets-10');
    expect(link.getAttribute('href')).toBe(`/shows/show-1/world?tab=scene-sets&set=set-venue&zone=ang-door&from=${encodeURIComponent('/episodes/ep-1/plan')}&fromLabel=Beat%20Plan`);
    expect(screen.queryByTestId('beat-generate-angle-10')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });
});
