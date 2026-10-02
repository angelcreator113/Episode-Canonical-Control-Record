/**
 * L10 (Evoni, 2026-10-02, docs/EVENT_EPISODE_FLOW.md §8(hh)): "When an
 * event has a dressed look, its episode's angles at that venue are made
 * from the dressed look instead of the plain approved base." At a set the
 * episode's event has a finished look on (location.look), the Beat Plan's
 * Generate angle and Upload image make the dressed angle; its cost is shown
 * first. A beat shows its dressed angle when there is one.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
const BRIEF = {
  version: 1, scene_set_id: 'set-venue', angle: 'DOORWAY', mode: 'full', source: { kind: 'look', look_id: 'look-1', image_url: 'https://x/look.jpg' },
  lines: [{ layer: 'event', key: 'concept', label: 'Event', text: 'Dressed for Velour Gala.', source: 'look', essential: true }],
  rules: ['An empty space with no people.'], missing: [], overrides: {},
};
const DRESSED = '/api/v1/episode-brief/ep-1/dressed-angles/ang-door';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}
const posts = (u) => vi.mocked(api.post).mock.calls.filter(([url]) => url === u);

describe('ScenePlannerPage: angles dressed from the event\'s look (L10)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${DRESSED}/brief`) return { data: { success: true, data: { target: { kind: 'dressed_angle', angle_id: 'ang-door' }, brief: BRIEF, estimate: { usd: 0.04, priced: true } } } };
      return { data: { success: true, data: {} } };
    });
  });

  test('a beat shows its dressed angle, tagged "Event look"; other beats show their own image', async () => {
    renderPage();
    await screen.findByTestId('beat-missing-10');
    const images = [...document.querySelectorAll('.scene-planner-card-image img')].map((img) => img.getAttribute('src'));
    expect(images).toEqual(['https://x/look.jpg', 'https://x/wide-dressed.jpg', 'https://x/home.jpg']);
    expect(screen.getByTestId('beat-dressed-tag-11')).toBeTruthy();
    expect(screen.queryByTestId('beat-dressed-tag-10')).toBeNull();
    expect(screen.getByTestId('beat-missing-look-10').textContent).toBe("Made from the event's look:");
  });

  test('Generate angle at the look\'s set shows the dressed brief and its cost, then dresses it; the plain angle is not generated', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('beat-generate-angle-10'));
    await screen.findByTestId('scene-brief-confirm');
    expect(posts(`${DRESSED}/brief`)).toHaveLength(1);
    expect(screen.getByText("Made from the event's look: the same dressed room, from this angle.")).toBeTruthy();
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.04');
    expect(posts(`${DRESSED}/generate`)).toHaveLength(0);

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(posts(`${DRESSED}/generate`)).toHaveLength(1));
    expect(posts(`${DRESSED}/generate`)[0][1]).toEqual({ overrides: {} });
    expect(vi.mocked(api.post).mock.calls.some(([u]) => u.startsWith('/api/v1/scene-sets/'))).toBe(false);
    expect(await screen.findByText("Beat 10: dressing the angle from the event's look")).toBeTruthy();
  });

  test('Upload image at the look\'s set stores the dressed angle', async () => {
    renderPage();
    await screen.findByTestId('beat-missing-10');
    const file = new File(['png'], 'door.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload image for beat 10'), { target: { files: [file] } });
    await waitFor(() => expect(posts(`${DRESSED}/upload`)).toHaveLength(1));
    expect(posts(`${DRESSED}/upload`)[0][1].get('images')).toBe(file);
    expect(vi.mocked(api.post).mock.calls.some(([u]) => u.startsWith('/api/v1/scene-sets/'))).toBe(false);
  });
});
