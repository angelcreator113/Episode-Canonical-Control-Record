/**
 * S9 (a) (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): "an
 * accurate background summary, such as 12 ready · 2 need attention ...
 * Only show the issues panel when something actually needs attention", and
 * the removed-set warning as "a specific, repairable Needs attention item".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab, { statusText } from './EpisodeScenesTab';

const HOME = { id: 'set-home', name: "Lala's Apartment", scene_type: 'HOME_BASE', base_still_url: 'https://x/home.jpg' };
const VENUE = { id: 'set-venue', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', base_still_url: null };
const GONE = { id: 'set-gone', name: "Lala's Closet", scene_type: 'CLOSET', base_still_url: 'https://x/closet.jpg', removed: true };
const beat = (n, set, extra = {}) => ({
  id: `p${n}`, beat_number: n, beat_name: `Beat ${n}`, scene_set_id: set?.id || null, locked: false, chosen_by_user: false,
  sceneSet: set, location: { role: 'home', kinds: [], angle: null, missing: null }, scene_id: null, ...extra,
});
let READINESS;

function renderTab() {
  render(
    <MemoryRouter initialEntries={['/episodes/ep-1?tab=scenes']}>
      <EpisodeScenesTab episode={{ id: 'ep-1', show_id: 'show-1' }} onToast={vi.fn()} />
    </MemoryRouter>
  );
}

describe('EpisodeScenesTab status (S9 a)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    const plan = [beat(1, HOME), beat(5, GONE), beat(10, VENUE), beat(14, null)];
    READINESS = {
      ready: 1, total: 4,
      not_ready: [
        { beat_number: 5, beat_name: 'Beat 5', text: "Lala's Closet was removed", fix: { kind: 'removed_set', scene_set_id: 'set-gone' } },
        { beat_number: 10, beat_name: 'Beat 10', text: 'Front zone missing', fix: { kind: 'scene_set', scene_set_id: 'set-venue', zone: 'front' } },
        { beat_number: 14, beat_name: 'Beat 14', text: 'No location', fix: { kind: 'locations' } },
      ],
    };
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: plan, readiness: READINESS } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: { show_id: 'show-1', editable: true, locations: [] } } };
      if (url === '/api/v1/episodes/ep-1/scenes') return { data: { success: true, data: [] } };
      if (url === '/api/v1/episodes/ep-1/removed-sets') return { data: { data: [{ scene_set_id: 'set-gone', name: "Lala's Closet", beats: [5] }] } };
      return { data: { data: [] } };
    });
  });

  test('statusText', () => {
    expect(statusText(null, 0)).toBe('No beats yet');
    expect(statusText({ ready: 12, total: 14, not_ready: [{}, {}] }, 14)).toBe('12 ready · 2 need attention');
    expect(statusText({ ready: 3, total: 4, not_ready: [{}] }, 4)).toBe('3 ready · 1 needs attention');
    expect(statusText({ ready: 6, total: 6, not_ready: [] }, 6)).toBe('All 6 backgrounds ready');
  });

  test('the status line counts what needs attention; Review issues lists each item with its fix', async () => {
    renderTab();
    expect((await screen.findByTestId('est-status-images')).textContent).toBe('Backgrounds: 1 ready · 3 need attention');
    expect(screen.queryByTestId('est-issues')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Review issues' }));
    const panel = screen.getByTestId('est-issues');
    expect(within(panel).getByTestId('est-issue-5').textContent).toContain("Beat 5 · Beat 5 — Lala's Closet was removed");
    expect(within(panel).getByTestId('est-issue-10').textContent).toContain('Beat 10 · Beat 10 — Front zone missing');
    expect(within(within(panel).getByTestId('est-issue-10')).getByRole('link', { name: 'Open in Scene Sets →' }).getAttribute('href'))
      .toMatch(/^\/shows\/show-1\/world\?tab=scene-sets&set=set-venue&zone=front&/);
    expect(within(within(panel).getByTestId('est-issue-14')).getByRole('button', { name: 'Edit locations' })).toBeTruthy();
    // The removed set's repair, "Move my beats", is in the panel.
    expect(await within(panel).findByTestId('removed-sets-banner')).toBeTruthy();
  });

  test('nothing to review when every background is ready', async () => {
    READINESS = { ready: 4, total: 4, not_ready: [] };
    renderTab();
    expect((await screen.findByTestId('est-status-images')).textContent).toBe('Backgrounds: All 4 backgrounds ready');
    expect(screen.queryByRole('button', { name: 'Review issues' })).toBeNull();
  });
});
