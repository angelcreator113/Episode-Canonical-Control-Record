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
  { id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', angles: [], generation_status: 'pending' },
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
