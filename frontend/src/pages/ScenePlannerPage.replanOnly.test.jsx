/**
 * S9 (d) (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): "the Beat
 * Plan page keeps re-planning only, and every per-beat change happens in
 * Scenes." It makes and re-makes the plan, and shows it; a beat is changed
 * in the Scenes tab.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';

const SET = { id: 'set-home', name: 'Lala apartment', base_still_url: 'https://x/home.jpg' };
const PLAN = [
  { id: 'p1', beat_number: 1, beat_name: 'Opening Ritual', scene_set_id: SET.id, sceneSet: SET, locked: true, chosen_by_user: false },
  { id: 'p2', beat_number: 2, beat_name: 'Login Sequence', scene_set_id: SET.id, sceneSet: SET, locked: false, chosen_by_user: true },
  { id: 'p10', beat_number: 10, beat_name: 'Event Travel', scene_set_id: SET.id, sceneSet: SET, locked: false, chosen_by_user: false,
    location: { role: 'event', kinds: ['front'], angle: null, missing: { reason: 'no_angle', kind: 'front', kinds: ['front'], label: 'ESTABLISHING', angle_id: null, name: 'Front', text: 'Front zone missing' } } },
];
let READINESS;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('ScenePlannerPage: re-planning only (S9 d)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    READINESS = { ready: 2, total: 3, not_ready: [{ beat_number: 10, text: 'Front zone missing' }] };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN, readiness: READINESS } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: { show_id: 'show-1', locations: [] } } };
      return { data: {} };
    });
  });

  test('it makes the plan; it offers no per-beat edit, lock, Lock All or script step', async () => {
    renderPage();
    await screen.findByTestId('beat-card-1');
    expect(screen.getByRole('button', { name: /Generate Scene Plan|Re-plan/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /🔒|🔓/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Lock All/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate Script/ })).toBeNull();
    expect(screen.queryByTestId('beat-editor')).toBeNull();
  });

  test('each beat changes in the Scenes tab; Locked and Chosen by you still show what a re-plan keeps', async () => {
    renderPage();
    const one = await screen.findByTestId('beat-card-1');
    expect(within(one).getByRole('link', { name: 'Change in Scenes →' }).getAttribute('href')).toBe('/episodes/ep-1?tab=scenes');
    expect(within(one).getByText('Locked')).toBeTruthy();
    expect(within(screen.getByTestId('beat-card-2')).getByText('Chosen by you')).toBeTruthy();
    expect(screen.getByTestId('beat-plan-scope').textContent)
      .toBe('A re-plan keeps locked and chosen beats. Change a beat\'s background, lock or unlock it in the Scenes tab.');
  });

  test('a missing image is a status here, fixed in Scenes; the removed-set repair is in Scenes too', async () => {
    renderPage();
    const ten = await screen.findByTestId('beat-card-10');
    expect(within(ten).getByTestId('beat-missing-10').textContent).toBe('Front zone missing');
    expect(within(ten).queryByRole('link', { name: 'Open in Scene Sets →' })).toBeNull();
    expect(within(screen.getByTestId('planner-readiness')).getByRole('link', { name: 'Fix them in Scenes →' }).getAttribute('href'))
      .toBe('/episodes/ep-1?tab=scenes');
    expect(vi.mocked(api.get).mock.calls.some(([u]) => u.endsWith('/removed-sets'))).toBe(false);
  });
});
