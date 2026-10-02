/**
 * Beat Plan display bugs (Evoni, 2026-10-02):
 *   1. "A beat with a set but no specific angle shows a blank image: it must
 *      show the set's base image (per Q21), labelled e.g. "Lala's Closet ·
 *      base"."
 *   2. "'No scene assigned' shows on beats that have a set ... show the set
 *      name, and only say something is missing when the set is."
 *   3. "Images don't refresh as sets/angles finish generating; the Beat
 *      Plan and Scenes tab update a beat's image without a reload."
 * The plan read carries location.image ({ url, source, label }) and
 * location.generating.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';
import { PLAN_REFRESH_MS } from '../components/BeatPlan/usePlanRefresh';

const closet = { id: 'set-closet', name: "Lala's Closet", base_still_url: 'https://x/closet.jpg' };
const beat = (n, extra) => ({ id: `p${n}`, beat_number: n, beat_name: `Beat ${n}`, locked: false, ...extra });
const PLAN = [
  // An old plan read: no sceneSet from the include, the picture from location.image.
  beat(4, { scene_set_id: 'set-closet', chosen_by_user: true, sceneSet: null,
    location: { role: 'home', kinds: [], angle: null, missing: null, generating: false,
      image: { url: 'https://x/closet.jpg', source: 'base', label: "Lala's Closet · base" } } }),
  beat(5, { scene_set_id: 'set-closet', sceneSet: closet,
    location: { role: 'home', kinds: [], angle: null, missing: null, generating: false,
      image: { url: 'https://x/closet.jpg', source: 'base', label: "Lala's Closet · base" } } }),
  beat(11, { scene_set_id: null, sceneSet: null, location: { role: 'event', kinds: [], angle: null, missing: null, generating: false, image: null } }),
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}
const planCalls = () => vi.mocked(api.get).mock.calls.filter(([u]) => u === '/api/v1/episode-brief/ep-1/plan').length;

describe('Beat Plan display (Evoni, 2026-10-02)', () => {
  let plan = PLAN;
  beforeEach(() => {
    plan = PLAN;
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: plan } };
      return { data: {} };
    });
  });
  afterEach(() => vi.useRealTimers());

  test('1: a beat at a set with no angle shows the base image, labelled "<set> · base"', async () => {
    renderPage();
    expect((await screen.findByTestId('beat-image-label-4')).textContent).toBe("Lala's Closet · base");
    const img = document.querySelector('[data-testid="beat-card-4"] .scene-planner-card-image img');
    expect(img.getAttribute('src')).toBe('https://x/closet.jpg');
    expect(screen.queryByTestId('beat-image-label-11')).toBeNull();
  });

  test('2: a beat with a set never says "No scene assigned"; only a beat with no set does', async () => {
    renderPage();
    await screen.findByTestId('beat-card-4');
    const name = (n) => screen.getByTestId(`beat-card-${n}`).querySelector('.scene-planner-card-scene-name').textContent;
    // The server now names every beat's set (beatPlanDisplay.integration);
    // a set id that names no set says the set is what is missing.
    expect(name(4)).toBe('Scene set not found');
    expect(name(5)).toBe("Lala's Closet");
    expect(name(11)).toBe('No scene assigned');
  });

  test('3: while a beat\'s image is generating the page re-reads the plan and shows the new image; it stops when nothing is', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The set's base is still being made: no image yet.
    plan = [beat(5, { scene_set_id: 'set-closet', sceneSet: { ...closet, base_still_url: null },
      location: { role: 'home', kinds: [], angle: null, missing: null, generating: true, image: null } })];
    renderPage();
    await screen.findByTestId('beat-card-5');
    expect(document.querySelector('[data-testid="beat-card-5"] .scene-planner-card-image img')).toBeNull();
    const before = planCalls();

    plan = PLAN;
    await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS + 50); });
    expect(planCalls()).toBe(before + 1);
    expect(document.querySelector('[data-testid="beat-card-5"] .scene-planner-card-image img').getAttribute('src')).toBe('https://x/closet.jpg');

    // Nothing generating now: no more reads.
    await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS * 3); });
    expect(planCalls()).toBe(before + 1);
  });
});
