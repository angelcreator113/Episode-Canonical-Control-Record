/**
 * ?set=<id> opens the Scene Sets page on that set (S7: the Event Package
 * links to the event's chosen set): its card is outlined; an unknown id says
 * the set was not found.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const SETS = [
  { id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', generation_status: 'pending', angles: [
    { id: 'a-front', angle_label: 'ESTABLISHING', angle_name: 'Front steps', angle_kind: 'front', generation_status: 'complete', still_image_url: 'https://x/f.jpg', sort_order: 0 },
    { id: 'a-back', angle_label: 'OTHER', angle_name: 'Green room', angle_kind: 'back', generation_status: 'pending', still_image_url: null, sort_order: 1 },
  ] },
  { id: 'set-2', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', angles: [], generation_status: 'pending' },
];

const renderAt = (search) => render(<MemoryRouter initialEntries={[`/shows/show-1/world${search}`]}><SceneSetsTab /></MemoryRouter>);
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);

describe('SceneSetsTab ?set=<id> (S7)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: SETS } } : { data: { success: true, data: [] } }
    ));
  });

  test('the named set is outlined, the others are not', async () => {
    renderAt('?tab=scene-sets&set=set-2');
    await waitFor(() => expect(card('set-2')).toBeTruthy());
    expect(card('set-2').classList.contains('scene-sets-card-focused')).toBe(true);
    expect(card('set-1').classList.contains('scene-sets-card-focused')).toBe(false);
    expect(screen.queryByTestId('scene-sets-focus-missing')).toBeNull();
  });

  test('an unknown set says so', async () => {
    renderAt('?tab=scene-sets&set=set-gone');
    expect(await screen.findByTestId('scene-sets-focus-missing')).toBeTruthy();
  });
});

// S8 (Evoni, 2026-10-02): "landing on the exact set and zone, with a way back
// to the page it came from."
describe('SceneSetsTab ?set=&zone=&from= (S8)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: SETS } } : { data: { success: true, data: [] } }
    ));
  });

  test('opens the set\'s panel on its angles with the zone marked, by angle id or by zone kind', async () => {
    renderAt('?tab=scene-sets&set=set-1&zone=a-back');
    const row = await waitFor(() => {
      const el = document.querySelector('[data-angle-id="a-back"]');
      if (!el) throw new Error('no zone row yet');
      return el;
    });
    expect(row.classList.contains('is-zone-focus')).toBe(true);
    expect(document.querySelector('[data-angle-id="a-front"]').classList.contains('is-zone-focus')).toBe(false);
  });

  test('a zone kind marks that zone', async () => {
    renderAt('?tab=scene-sets&set=set-1&zone=front');
    const row = await waitFor(() => {
      const el = document.querySelector('[data-angle-id="a-front"]');
      if (!el) throw new Error('no zone row yet');
      return el;
    });
    expect(row.classList.contains('is-zone-focus')).toBe(true);
  });

  test('shows the way back to the page it came from', async () => {
    renderAt('?tab=scene-sets&set=set-1&from=%2Fepisodes%2Fep-1%2Fplan&fromLabel=Beat%20Plan');
    expect((await screen.findByTestId('scene-sets-back')).getAttribute('href')).toBe('/episodes/ep-1/plan');
  });
});
