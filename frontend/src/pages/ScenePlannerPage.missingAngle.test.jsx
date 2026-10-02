/**
 * L4 (Evoni, 2026-10-02) and her answer Q19 (§8(hh)): "A missing angle shows
 * a specific action: 'Entrance angle missing — Upload image / Generate
 * angle'." "Generate angle" opens that angle's brief; "Upload image" creates
 * the angle from the file.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
const BRIEF = {
  version: 1, scene_set_id: 'set-venue', angle: 'DOORWAY', mode: 'full',
  lines: [{ layer: 'place', key: 'identity', label: 'Place', text: 'The Glasshouse.', source: 'venue', essential: true }],
  rules: ['An empty space with no people.'], missing: [], overrides: {},
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}
const posts = (suffix) => vi.mocked(api.post).mock.calls.filter(([u]) => u.endsWith(suffix));

describe('ScenePlannerPage: missing angles (L4, Q19)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/api/v1/scene-sets/set-venue/angles') return { data: { success: true, data: { id: 'ang-new', angle_label: 'DOORWAY' } } };
      if (url.endsWith('/brief')) return { data: { success: true, data: { target: { kind: 'angle', angle_id: 'ang-new' }, brief: BRIEF, estimate: null } } };
      return { data: { success: true } };
    });
  });

  test('a beat with a missing angle names it; a beat with nothing missing says nothing', async () => {
    renderPage();
    const missing = await screen.findByTestId('beat-missing-10');
    expect(missing.textContent).toContain('Entrance or exterior angle missing');
    expect(within(missing).getByText('Upload image')).toBeTruthy();
    expect(within(missing).getByText('Generate angle')).toBeTruthy();
    expect(screen.getByTestId('beat-missing-11').textContent).toContain('Main hall angle has no image');
    expect(screen.queryByTestId('beat-missing-1')).toBeNull();
  });

  test('Generate angle creates the entrance angle, points the beat at it, and opens its brief; generating waits for Confirm', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('beat-generate-angle-10'));

    await waitFor(() => expect(posts('/api/v1/scene-sets/set-venue/angles')).toHaveLength(1));
    expect(posts('/api/v1/scene-sets/set-venue/angles')[0][1]).toEqual({
      angle_label: 'DOORWAY', angle_name: 'Entrance', angle_kind: 'entrance', beat_affinity: [10],
    });
    expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/10', { angle_label: 'DOORWAY' });
    await screen.findByTestId('scene-brief-confirm');
    expect(posts('/brief')[0][1]).toMatchObject({ angle_id: 'ang-new' });
    expect(posts('/generate')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(posts('/api/v1/scene-sets/set-venue/angles/ang-new/generate')).toHaveLength(1));
    expect(posts('/api/v1/scene-sets/set-venue/angles/ang-new/generate')[0][1]).toEqual({ overrides: {} });
  });

  test('an angle with no image is generated as it is: nothing is created, a locked beat is not changed', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('beat-generate-angle-11'));
    await screen.findByTestId('scene-brief-confirm');
    expect(posts('/api/v1/scene-sets/set-venue/angles')).toHaveLength(0);
    expect(api.put).not.toHaveBeenCalled();
    expect(posts('/brief')[0][1]).toMatchObject({ angle_id: 'ang-wide' });
  });

  test('Upload image creates the angle from the file', async () => {
    renderPage();
    await screen.findByTestId('beat-missing-10');
    const file = new File(['png'], 'door.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload image for beat 10'), { target: { files: [file] } });

    await waitFor(() => expect(posts('/api/v1/scene-sets/set-venue/angles/ang-new/upload')).toHaveLength(1));
    const [, form] = posts('/api/v1/scene-sets/set-venue/angles/ang-new/upload')[0];
    expect(form.get('images')).toBe(file);
    expect(posts('/api/v1/scene-sets/set-venue/angles')).toHaveLength(1);
    expect(await screen.findByText('Beat 10: image uploaded')).toBeTruthy();
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
