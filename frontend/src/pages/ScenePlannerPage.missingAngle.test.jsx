/**
 * L4 (Evoni, 2026-10-02) and her answer Q19 (§8(hh)): "A missing angle shows
 * a specific action". Since S8 (§8(dd)) that action is "Open in Scene Sets →",
 * landing on the set and zone; the Beat Plan no longer uploads or generates.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';

const MISSING = {
  role: 'event', kinds: ['entrance', 'exterior'], angle: null,
  missing: { reason: 'no_angle', kind: 'entrance', kinds: ['entrance', 'exterior'], label: 'DOORWAY', angle_id: null, name: 'Entrance', text: 'Entrance or exterior angle missing' },
};
const NO_IMAGE = {
  role: 'event', kinds: ['main_interior'], angle: { id: 'ang-wide', label: 'WIDE', name: 'Main hall' },
  missing: { reason: 'no_image', kind: 'main_interior', kinds: [], label: 'WIDE', angle_id: 'ang-wide', name: 'Main hall', text: 'Main hall angle has no image' },
};
const PLAN = [
  { id: 'p1', beat_number: 1, beat_name: 'Opening Ritual', scene_set_id: 'set-home', locked: false, sceneSet: { id: 'set-home', name: 'Apartment' }, location: { role: 'home', kinds: [], angle: null, missing: null } },
  { id: 'p10', beat_number: 10, beat_name: 'Event Travel', scene_set_id: 'set-venue', angle_label: null, locked: false, sceneSet: { id: 'set-venue', name: 'The Glasshouse' }, location: MISSING },
  { id: 'p11', beat_number: 11, beat_name: 'Event Outcome', scene_set_id: 'set-venue', angle_label: 'WIDE', locked: true, sceneSet: { id: 'set-venue', name: 'The Glasshouse' }, location: NO_IMAGE },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('ScenePlannerPage: missing angles (L4, Q19)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { data: { locations: [], show_id: 'show-1' } } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
  });

  test('a beat with a missing angle names it; a beat with nothing missing says nothing', async () => {
    renderPage();
    const missing = await screen.findByTestId('beat-missing-10');
    expect(missing.textContent).toContain('Entrance or exterior angle missing');
    // S8: the action is "Open in Scene Sets →" (see below).
    expect(within(missing).getByText('Open in Scene Sets →')).toBeTruthy();
    expect(screen.getByTestId('beat-missing-11').textContent).toContain('Main hall angle has no image');
    expect(screen.queryByTestId('beat-missing-1')).toBeNull();
  });

  // S8 (Evoni, 2026-10-02; §8(dd)): "Other pages (Beat Plan, Scenes tab, ...)
  // show status only, with one entry point: 'Open in Scene Sets →', landing
  // on the exact set and zone, with a way back ... Their own upload, generate
  // and add-angle buttons are removed."
  test('S8: a missing angle shows its status and "Open in Scene Sets →" on that set and zone; no upload or generate', async () => {
    renderPage();
    const m10 = await screen.findByTestId('beat-missing-10');
    expect(within(m10).queryByText('Upload image')).toBeNull();
    expect(within(m10).queryByText('Generate angle')).toBeNull();
    const back = encodeURIComponent('/episodes/ep-1/plan');
    expect(within(m10).getByRole('link', { name: 'Open in Scene Sets →' }).getAttribute('href'))
      .toBe(`/shows/show-1/world?tab=scene-sets&set=set-venue&zone=entrance&from=${back}&fromLabel=Beat%20Plan`);
    // An angle with no image: the link lands on that angle.
    const m11 = screen.getByTestId('beat-missing-11');
    expect(within(m11).getByRole('link', { name: 'Open in Scene Sets →' }).getAttribute('href'))
      .toBe(`/shows/show-1/world?tab=scene-sets&set=set-venue&zone=ang-wide&from=${back}&fromLabel=Beat%20Plan`);
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('ScenePlannerPage: the readiness flag (L5, Q21)', () => {
  const READY = (r) => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN, readiness: r } };
      return { data: {} };
    });
  };

  test('names the beats still needing an image, and says planning and writing go on', async () => {
    READY({ ready: 12, total: 14, not_ready: [{ beat_number: 10 }, { beat_number: 11 }] });
    renderPage();
    const flag = await screen.findByTestId('planner-readiness');
    expect(flag.textContent).toBe('12/14 beats have their image; still needed: beats 10, 11. Planning and writing can go on.');
    expect(flag.className).toContain('is-short');
  });

  test('says so when every beat has its image', async () => {
    READY({ ready: 14, total: 14, not_ready: [] });
    renderPage();
    expect((await screen.findByTestId('planner-readiness')).textContent).toBe('Every beat has its image (14/14).');
  });
});
