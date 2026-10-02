/**
 * Beat Plan display bugs (Evoni, 2026-10-02) on the Scenes tab: a beat shows
 * where its picture comes from ("Lala's Closet · base"), names its set when
 * it has one, and its image updates without a reload while it generates.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab from './EpisodeScenesTab';
import { PLAN_REFRESH_MS } from '../BeatPlan/usePlanRefresh';

const CLOSET = { id: 'set-closet', name: "Lala's Closet", scene_type: 'CLOSET', base_still_url: 'https://x/closet.jpg' };
const beat = (n, extra) => ({ id: `p${n}`, beat_number: n, beat_name: `Beat ${n}`, scene_set_id: CLOSET.id, locked: false, sceneSet: CLOSET, scene_id: null, ...extra });
const READY = [beat(4, { location: { role: 'home', kinds: [], angle: null, missing: null, generating: false,
  image: { url: 'https://x/closet.jpg', source: 'base', label: "Lala's Closet · Inside" } } })];
let PLAN;

const planCalls = () => vi.mocked(apiClient.get).mock.calls.filter(([u]) => u === '/api/v1/episode-brief/ep-1/plan').length;

describe('EpisodeScenesTab: beat display (Evoni, 2026-10-02)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    PLAN = READY;
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN, readiness: { ready: 1, total: 1, not_ready: [] } } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: { show_id: 'show-1', locations: [] } } };
      if (url === '/api/v1/episodes/ep-1/scenes') return { data: { success: true, data: [] } };
      return { data: {} };
    });
  });
  afterEach(() => vi.useRealTimers());

  const renderTab = () => render(<MemoryRouter><EpisodeScenesTab episode={{ id: 'ep-1', show_id: 'show-1' }} onToast={vi.fn()} /></MemoryRouter>);

  test('a beat on its set\'s base reads "<set> · Inside" with the base image (S9 b)', async () => {
    renderTab();
    expect((await screen.findByTestId('est-where-4')).textContent).toBe("Lala's Closet · Inside");
    expect(screen.getByTestId('est-beat-4').querySelector('img').getAttribute('src')).toBe('https://x/closet.jpg');
  });

  test('while the image is generating the tab re-reads the plan and shows it, then stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    PLAN = [beat(4, { sceneSet: { ...CLOSET, base_still_url: null }, location: { role: 'home', kinds: [], angle: null, missing: null, generating: true, image: null } })];
    renderTab();
    await screen.findByTestId('est-beat-4');
    expect(screen.getByTestId('est-beat-4').querySelector('img')).toBeNull();
    const before = planCalls();
    PLAN = READY;
    await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS + 50); });
    expect(planCalls()).toBe(before + 1);
    expect(screen.getByTestId('est-beat-4').querySelector('img').getAttribute('src')).toBe('https://x/closet.jpg');
    await act(async () => { await vi.advanceTimersByTimeAsync(PLAN_REFRESH_MS * 3); });
    expect(planCalls()).toBe(before + 1);
  });
});
